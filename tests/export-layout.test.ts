import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTemplate, COLUMN_WIDTH } from '../src/lib/board';
import { exportLayout, EXPORT_CARD_WIDTH } from '../src/lib/export-layout';

test('Las columnas vacías se estrechan y todas las tarjetas conservan su columna y su contenido', () => {
  const board = makeTemplate();
  const original = structuredClone(board);
  const layout = exportLayout(board);
  assert.equal(layout.columns.length, board.columns.length);
  assert.equal(layout.columns.flatMap(column => column.cards).length, board.cards.length);
  for (const column of layout.columns) {
    if (!column.cards.length) assert.ok(column.width < COLUMN_WIDTH);
    else assert.ok(column.width >= EXPORT_CARD_WIDTH);
    for (const card of column.cards) assert.equal(Math.floor((card.x + 114) / COLUMN_WIDTH), column.position);
  }
  assert.deepEqual(board, original);
});

test('Una columna con muchas tarjetas aprovecha varias filas y reduce la anchura respecto del lienzo', () => {
  const board = makeTemplate();
  board.cards = Array.from({ length: 13 }, (_, index) => ({ ...board.cards[0], id: crypto.randomUUID(), x: 536, y: 94 + index * 300, description: 'Descripción de la tarea y su alcance. '.repeat(3) }));
  const layout = exportLayout(board);
  assert.ok(layout.columns[2].lanes > 1);
  assert.ok(layout.width < board.columns.length * COLUMN_WIDTH);
  assert.equal(layout.columns[2].cards.length, 13);
  assert.equal(new Set(layout.columns[2].cards.map(card => card.id)).size, 13);
});

test('La exportación ordena por posición vertical sin heredar espacios vacíos ni perder títulos largos', () => {
  const board = makeTemplate(false);
  board.columns[0].name = 'Una columna con un título largo que debe conservarse completo';
  const sample = makeTemplate().cards[0];
  board.cards = [{ ...sample, id: crypto.randomUUID(), x: 536, y: 9000 }, { ...sample, id: crypto.randomUUID(), x: 536, y: 90 }];
  const layout = exportLayout(board);
  assert.equal(layout.columns[0].name, board.columns[0].name);
  assert.equal(layout.columns[2].cards[0].y, 90);
  assert.ok(layout.columns[2].estimatedHeight < 1000);
});
