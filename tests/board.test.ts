import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardSchema, makeTemplate, clampPosition, boardHeight, COLUMN_WIDTH, CARD_WIDTH, HEADER_HEIGHT } from '../src/lib/board';
test('La plantilla contiene las seis etapas y tres prioridades válidas', () => {
  const board = makeTemplate();
  assert.equal(board.columns.length, 6);
  assert.ok(boardSchema.safeParse(board).success);
  assert.deepEqual(new Set(board.cards.map(c => c.priority)), new Set(['high', 'medium', 'low']));
  assert.equal(makeTemplate(false).cards.length, 0);
});
test('El movimiento permite ambos ejes y limita las posiciones al lienzo', () => {
  assert.deepEqual(clampPosition(123.4, 200.7, 6), { x: 123, y: 201 });
  assert.deepEqual(clampPosition(-500, -2, 1), { x: 0, y: HEADER_HEIGHT });
  assert.deepEqual(clampPosition(99999, 99999, 6), { x: 6 * COLUMN_WIDTH - CARD_WIDTH, y: 10000 });
});
test('El lienzo crece para incluir tarjetas muy abajo y texto largo', () => {
  const board = makeTemplate();
  board.cards[0] = { ...board.cards[0], y: 4200, name: 'Nombre extenso', description: 'Texto extenso '.repeat(20) };
  assert.ok(boardHeight(board.cards) > 4500);
});
test('La validación rechaza prioridades, coordenadas, colores y UUID repetidos inválidos', () => {
  const board = makeTemplate();
  assert.equal(boardSchema.safeParse({ ...board, cards: [{ ...board.cards[0], priority: 'urgent' }] }).success, false);
  assert.equal(boardSchema.safeParse({ ...board, cards: [{ ...board.cards[0], x: -1 }] }).success, false);
  assert.equal(boardSchema.safeParse({ ...board, cards: [{ ...board.cards[0], y: 0 }] }).success, false);
  assert.equal(boardSchema.safeParse({ ...board, columns: board.columns.map(c => ({ ...c, color: 'url(script)' })) }).success, false);
  assert.equal(boardSchema.safeParse({ ...board, cards: [board.cards[0], board.cards[0]] }).success, false);
  assert.equal(boardSchema.safeParse({ ...board, columns: [] }).success, false);
});
test('Las fechas de iteración admiten rangos válidos y rechazan fechas inexistentes o invertidas', () => {
  const board = { ...makeTemplate(false), iteration: 'IT-01', startDate: '2026-01-19', endDate: '2026-01-25' };
  assert.equal(boardSchema.safeParse(board).success, true);
  assert.equal(boardSchema.safeParse({ ...board, startDate: '2026-02-30' }).success, false);
  assert.equal(boardSchema.safeParse({ ...board, endDate: '2026-01-18' }).success, false);
  assert.equal(boardSchema.safeParse({ ...board, startDate: '' }).success, true);
});
test('Nombre y descripción se validan por separado y ambos determinan la altura del lienzo', () => {
  const board = makeTemplate();
  const card = { ...board.cards[0], name: 'Consultar expediente', description: 'Detalle de la tarea' };
  assert.equal(boardSchema.safeParse({ ...board, cards: [card] }).success, true);
  assert.equal(boardSchema.safeParse({ ...board, cards: [{ ...card, name: ' ' }] }).success, false);
  assert.equal(boardSchema.safeParse({ ...board, cards: [{ ...card, description: 'x'.repeat(2001) }] }).success, false);
  assert.ok(boardHeight([{ ...card, y: 600, description: 'Descripción extensa '.repeat(80) }]) > boardHeight([{ ...card, y: 600 }]));
});
