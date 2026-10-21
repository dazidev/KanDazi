import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boardSchema, cardHeight, COLUMN_WIDTH } from '../src/lib/board';

const source = JSON.parse(readFileSync(new URL('../data/thesis-iterations.json', import.meta.url), 'utf8'));
const entries = source.boards as { id: string; data: unknown }[];
const boards = entries.map(entry => boardSchema.parse(entry.data));
const audit = JSON.parse(readFileSync(new URL('../data/thesis-priorities.json', import.meta.url), 'utf8'));

test('La carga contiene 19 iteraciones válidas, 69 apariciones originales y 13 de continuidad con claves únicas', () => {
  assert.equal(boards.length, 19);
  assert.deepEqual(boards.map(board => board.iteration), Array.from({ length: 19 }, (_, index) => `IT-${String(index + 1).padStart(2, '0')}`));
  assert.equal(boards.reduce((count, board) => count + board.cards.length, 0), 82);
  assert.equal(new Set(boards.flatMap(board => board.cards).filter(card => !card.code.startsWith('TEC-')).map(card => card.code)).size, 50);
  const ids = entries.flatMap((entry, index) => [entry.id, ...boards[index].columns.map(column => column.id), ...boards[index].cards.map(card => card.id)]);
  assert.equal(new Set(ids).size, ids.length);
});

test('Cada identificador aparece en todas las iteraciones entre su primera y su última aparición', () => {
  const codes = new Set(boards.flatMap(board => board.cards.map(card => card.code)));
  for (const code of codes) {
    const indexes = boards.flatMap((board, index) => board.cards.some(card => card.code === code) ? [index] : []);
    assert.equal(indexes.length, indexes.at(-1)! - indexes[0] + 1, `Recorrido incompleto de ${code}`);
    for (const index of indexes) assert.equal(boards[index].cards.filter(card => card.code === code).length, 1);
  }
});

test('Cada tablero conserva una semana de lunes a domingo, nombre de iteración y módulos', () => {
  for (const [index, board] of boards.entries()) {
    assert.equal(board.title, `Iteración ${String(index + 1).padStart(2, '0')}`);
    assert.ok(board.goal.length > 0);
    assert.equal(new Date(`${board.startDate}T00:00:00Z`).getUTCDay(), 1);
    assert.equal(new Date(`${board.endDate}T00:00:00Z`).getUTCDay(), 0);
    assert.equal(Date.parse(board.endDate) - Date.parse(board.startDate), 6 * 86400000);
  }
  assert.equal(boards[0].startDate, '2026-01-19');
  assert.equal(boards[18].endDate, '2026-10-04');
});

test('Las tarjetas repetidas se aplazan y las últimas apariciones quedan en Completada, sin superponerse', () => {
  for (const board of boards) {
    const completed = board.columns.find(column => column.name === 'Completada')!;
    for (const [index, card] of board.cards.entries()) {
      assert.ok(card.code && card.name && card.description);
      const hasLater = boards.some(candidate => candidate.startDate > board.endDate && candidate.cards.some(other => other.code === card.code));
      const column = hasLater ? board.columns.find(column => column.name === 'Siguiente iteración')! : completed;
      assert.ok(column);
      assert.equal(Math.floor(card.x / COLUMN_WIDTH), column.position);
      for (const before of board.cards.slice(0, index).filter(other => Math.floor(other.x / COLUMN_WIDTH) === column.position)) assert.ok(before.y + cardHeight(before) + 20 <= card.y);
    }
  }
});

test('Las prioridades siguen el anexo por funcionalidad y no códigos incompatibles del catálogo', () => {
  const priorities = new Map(audit.cards.map((card: { card: string; priority: string }) => [card.card, card.priority]));
  for (const board of boards) for (const card of board.cards) assert.equal(card.priority, priorities.get(card.code));
  const find = (code: string) => audit.cards.find((card: { card: string }) => card.card === code);
  assert.deepEqual(find('PRO-01').requirements, ['RF12']); // RF09 now means registration requests.
  assert.deepEqual(find('EST-02').requirements, ['RF22']); // RF19 now means viewing stages.
  assert.equal(find('EST-02').priority, 'high');
  assert.equal(find('ADM-04').priority, 'high'); // Highest of invitation generation and consultation.
  assert.equal(find('DOC-01').basis, 'provisional'); // RF28 in the annex is substage deletion, not folder creation.
  assert.equal(find('DOC-01').priority, 'medium');
  assert.equal(find('ADM-03').basis, 'provisional'); // RNF11 has no documented priority.
  for (const card of audit.cards) {
    if (card.basis === 'provisional') { assert.equal(card.priority, 'medium'); continue; }
    const scores = card.requirements.map((code: string) => ({ Baja: 0, Media: 1, Alta: 2 }[audit.requirements.find((requirement: { code: string }) => requirement.code === code).priority as 'Baja' | 'Media' | 'Alta']));
    assert.equal(card.priority, ['low', 'medium', 'high'][Math.max(...scores)]);
  }
});
