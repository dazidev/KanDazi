import { CARD_WIDTH, COLUMN_WIDTH, cardHeight, type Board } from './board';

export type CarryoverChange = { boardId: string; iteration: string; cardId: string; code: string; nextIteration: string };
const normalize = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export function organizeCarryovers(input: Board[]) {
  const boards = input.map(board => ({ ...board, columns: board.columns.map(column => ({ ...column })), cards: board.cards.map(card => ({ ...card })) }));
  const chronological = boards.filter(board => board.startDate && board.endDate).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const changes: CarryoverChange[] = [];
  for (const board of chronological) {
    for (const card of board.cards) {
      if (!card.code.trim()) continue;
      const next = chronological.find(candidate => candidate.startDate > board.endDate && candidate.cards.some(other => other.code.trim() === card.code.trim()));
      if (!next) continue;
      let column = board.columns.find(candidate => normalize(candidate.name) === 'siguiente iteracion');
      if (!column) {
        if (board.columns.length >= 20) throw new Error(`${board.title} ya tiene 20 columnas.`);
        column = { id: crypto.randomUUID(), name: 'Siguiente iteración', color: '#D6EBEA', position: board.columns.length };
        board.columns.push(column);
      }
      const inColumn = (x: number) => Math.floor((x + CARD_WIDTH / 2) / COLUMN_WIDTH) === column.position;
      if (inColumn(card.x)) continue; // Keep the user's existing layout in this column.
      const y = Math.max(94, ...board.cards.filter(other => other.id !== card.id && inColumn(other.x)).map(other => other.y + cardHeight(other) + 20));
      if (y > 10000) throw new Error(`No hay espacio vertical en ${board.title}.`);
      card.x = column.position * COLUMN_WIDTH + 16;
      card.y = y;
      changes.push({ boardId: board.id, iteration: board.iteration, cardId: card.id, code: card.code, nextIteration: next.iteration });
    }
  }
  return { boards, changes };
}
