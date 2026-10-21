import { test } from 'node:test';
import assert from 'node:assert/strict';
import { organizeCarryovers } from '../src/lib/iteration-carryover';
import { makeTemplate, cardHeight, type Board } from '../src/lib/board';

function board(iteration: string, startDate: string, endDate: string, codes: string[]): Board {
  return { ...makeTemplate(false), id: crypto.randomUUID(), title: iteration, iteration, startDate, endDate, revision: 0, updatedAt: '', cards: codes.map((code, index) => ({ id: crypto.randomUUID(), code, name: 'Una tarea', description: 'Alcance', priority: 'medium', x: 536, y: 94 + index * 200 })) };
}
test('Solo las apariciones anteriores pasan a Siguiente iteración, incluso entre semanas no consecutivas', () => {
  const first = board('IT-01', '2026-01-19', '2026-01-25', ['ADM-01', 'ADM-02', '']);
  const last = board('IT-03', '2026-04-13', '2026-04-19', ['ADM-01']);
  const original = structuredClone([last, first]);
  const result = organizeCarryovers([last, first]);
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].nextIteration, 'IT-03');
  assert.equal(result.boards[1].columns.at(-1)?.name, 'Siguiente iteración');
  assert.equal(result.boards[1].cards[0].x, 1576);
  assert.equal(result.boards[1].cards[1].x, 536); // Same title but a different code.
  assert.equal(result.boards[1].cards[2].x, 536); // Empty identifiers are never grouped.
  assert.deepEqual(result.boards[0], last);
  assert.deepEqual([last, first], original);
  assert.equal(organizeCarryovers(result.boards).changes.length, 0);
});
test('Se reutiliza la columna del usuario y se conservan sus posiciones y estados manuales', () => {
  const first = board('IT-01', '2026-01-19', '2026-01-25', ['ADM-01', 'ADM-02']);
  first.columns.push({ id: crypto.randomUUID(), name: 'Siguiente Iteración', color: '#AABBCC', position: 6 });
  first.cards[0].x = 1576; first.cards[0].y = 255;
  const last = board('IT-02', '2026-02-02', '2026-02-08', ['ADM-01', 'ADM-02']);
  last.cards[0].x = 1316; // Finalizada.
  const result = organizeCarryovers([first, last]);
  assert.equal(result.changes.length, 1);
  assert.deepEqual(result.boards[0].columns, first.columns);
  assert.deepEqual(result.boards[0].cards[0], first.cards[0]);
  assert.ok(result.boards[0].cards[1].y >= 255 + cardHeight(first.cards[0]) + 20);
  assert.deepEqual(result.boards[1], last);
});
test('Una tarjeta presente en tres iteraciones se aplaza en las dos primeras y conserva la última', () => {
  const input = [board('IT-01', '2026-01-19', '2026-01-25', ['ADM-01']), board('IT-02', '2026-02-02', '2026-02-08', ['ADM-01']), board('IT-03', '2026-04-13', '2026-04-19', ['ADM-01'])];
  const result = organizeCarryovers(input);
  assert.equal(result.changes.length, 2);
  assert.deepEqual(result.changes.map(change => change.nextIteration), ['IT-02', 'IT-03']);
  assert.deepEqual(result.boards[2], input[2]);
});
test('Una tarjeta que pasa de IT-02 a IT-05 aparece también en IT-03 e IT-04, sin extenderse fuera de su recorrido', () => {
  const input = [
    board('IT-01', '2026-01-19', '2026-01-25', []),
    board('IT-02', '2026-02-02', '2026-02-08', ['ADM-01']),
    board('IT-03', '2026-02-09', '2026-02-15', []),
    board('IT-04', '2026-02-16', '2026-02-22', []),
    board('IT-05', '2026-02-23', '2026-03-01', ['ADM-01']),
    board('IT-06', '2026-03-02', '2026-03-08', []),
  ];
  input[1].cards[0].description = 'Alcance en la iteración 2';
  input[4].cards[0].description = 'Alcance ampliado en la iteración 5';
  input[4].cards[0].x = 1316;
  const original = structuredClone(input);
  const result = organizeCarryovers(input);
  assert.equal(result.changes.filter(change => change.kind === 'created').length, 2);
  for (const index of [2, 3]) {
    const card = result.boards[index].cards[0];
    assert.equal(card.code, 'ADM-01');
    assert.equal(card.name, input[1].cards[0].name);
    assert.equal(card.description, 'Alcance en la iteración 2');
    assert.equal(card.priority, input[1].cards[0].priority);
    assert.equal(card.x, 1576);
  }
  assert.equal(new Set(result.boards.flatMap(board => board.cards.map(card => card.id))).size, 4);
  assert.deepEqual(result.boards[0], input[0]);
  assert.deepEqual(result.boards[4], input[4]);
  assert.deepEqual(result.boards[5], input[5]);
  assert.deepEqual(input, original);
  const repeated = organizeCarryovers(result.boards);
  assert.equal(repeated.changes.length, 0);
  assert.deepEqual(repeated.boards, result.boards);
});
