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
