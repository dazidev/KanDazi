import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Board } from '../src/lib/board';
const base = process.env.TEST_BASE_URL;
test('CRUD persistente, posiciones libres, validación y conflictos de revisión', { skip: !base }, async () => {
  let id = '';
  try {
    const created = await fetch(`${base}/api/boards`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'QA temporal', template: true }) });
    assert.equal(created.status, 201);
    const board = await created.json() as Board; id = board.id;
    assert.equal(board.columns.length, 6);
    board.cards = [{ id: randomUUID(), code: 'QA-01', name: 'Verificar persistencia', description: 'Descripción de prueba', priority: 'high', x: 342, y: 722 }];
    board.columns[0].name = 'Etapa personalizada'; board.columns[0].color = '#AABBCC';
    board.goal = 'Gestión de usuarios'; board.iteration = 'IT-01'; board.startDate = '2026-01-19'; board.endDate = '2026-01-25';
    const update = await fetch(`${base}/api/boards/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(board) });
    assert.equal(update.status, 200);
    const saved = await update.json() as Board;
    assert.equal(saved.revision, 1);
    const read = await fetch(`${base}/api/boards`).then(r => r.json()) as Board[];
    const loaded = read.find(b => b.id === id)!;
    assert.equal(loaded.cards[0].x, 342); assert.equal(loaded.cards[0].y, 722);
    assert.equal(loaded.cards[0].code, 'QA-01'); assert.equal(loaded.cards[0].description, 'Descripción de prueba');
    assert.equal(loaded.iteration, 'IT-01'); assert.equal(loaded.startDate, '2026-01-19'); assert.equal(loaded.endDate, '2026-01-25');
    assert.equal(loaded.columns[0].color, '#AABBCC'); assert.equal(loaded.goal, board.goal);
    const conflict = await fetch(`${base}/api/boards/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(board) });
    assert.equal(conflict.status, 409);
    const invalid = await fetch(`${base}/api/boards/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...saved, cards: [{ ...saved.cards[0], priority: 'invalid' }] }) });
    assert.equal(invalid.status, 400);
    // Rejecting an invalid write must preserve the last valid content.
    const after = await fetch(`${base}/api/boards`).then(r => r.json()) as Board[];
    assert.equal(after.find(b => b.id === id)?.cards[0].name, 'Verificar persistencia');
  } finally {
    if (id) {
      const response = await fetch(`${base}/api/boards/${id}`, { method: 'DELETE' });
      assert.equal(response.status, 204);
      const remaining = await fetch(`${base}/api/boards`).then(r => r.json()) as Board[];
      assert.ok(!remaining.some(b => b.id === id));
    }
  }
});
