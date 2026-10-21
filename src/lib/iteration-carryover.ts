import { CARD_WIDTH, COLUMN_WIDTH, cardHeight, type Board, type Card } from './board';

export type CarryoverChange = { kind: 'created' | 'moved'; boardId: string; iteration: string; cardId: string; code: string; nextIteration: string };
const normalize = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export function organizeCarryovers(input: Board[]) {
  const boards = input.map(board => ({ ...board, columns: board.columns.map(column => ({ ...column })), cards: board.cards.map(card => ({ ...card })) }));
  const chronological = boards.filter(board => board.startDate && board.endDate).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const changes: CarryoverChange[] = [];
  function nextColumn(board: Board) {
    let column = board.columns.find(candidate => normalize(candidate.name) === 'siguiente iteracion');
    if (!column) {
      if (board.columns.length >= 20) throw new Error(`${board.title} ya tiene 20 columnas.`);
      column = { id: crypto.randomUUID(), name: 'Siguiente iteración', color: '#D6EBEA', position: board.columns.length };
      board.columns.push(column);
    }
    return column;
  }
  function place(board: Board, card: Card) {
    const column = nextColumn(board);
    const y = Math.max(94, ...board.cards.filter(other => other.id !== card.id && Math.floor((other.x + CARD_WIDTH / 2) / COLUMN_WIDTH) === column.position).map(other => other.y + cardHeight(other) + 20));
    if (y > 10000) throw new Error(`No hay espacio vertical en ${board.title}.`);
    card.x = column.position * COLUMN_WIDTH + 16;
    card.y = y;
  }

  // Fill only the gaps between existing appearances. Transit copies use the
  // most recent preceding appearance's details and never imply new work.
  const occurrences = new Map<string, { index: number; card: Card }[]>();
  chronological.forEach((board, index) => board.cards.forEach(card => {
    const code = card.code.trim();
    if (code) occurrences.set(code, [...(occurrences.get(code) ?? []), { index, card: { ...card } }]);
  }));
  for (const appearances of occurrences.values()) {
    if (appearances.length < 2) continue;
    const first = appearances[0].index, last = appearances.at(-1)!.index;
    for (let index = first + 1; index < last; index++) {
      const board = chronological[index];
      const previous = appearances.filter(appearance => appearance.index < index).at(-1)!;
      if (board.cards.some(card => card.code.trim() === previous.card.code.trim())) continue;
      if (board.cards.length >= 300) throw new Error(`${board.title} ya tiene 300 tarjetas.`);
      const card = { ...previous.card, id: crypto.randomUUID() };
      place(board, card);
      board.cards.push(card);
      changes.push({ kind: 'created', boardId: board.id, iteration: board.iteration, cardId: card.id, code: card.code, nextIteration: chronological[index + 1].iteration });
    }
  }
  for (const board of chronological) {
    for (const card of board.cards) {
      if (!card.code.trim()) continue;
      const next = chronological.find(candidate => candidate.startDate > board.endDate && candidate.cards.some(other => other.code.trim() === card.code.trim()));
      if (!next) continue;
      const column = nextColumn(board);
      const inColumn = (x: number) => Math.floor((x + CARD_WIDTH / 2) / COLUMN_WIDTH) === column.position;
      if (inColumn(card.x)) continue; // Keep the user's existing layout in this column.
      place(board, card);
      changes.push({ kind: 'moved', boardId: board.id, iteration: board.iteration, cardId: card.id, code: card.code, nextIteration: next.iteration });
    }
  }
  return { boards, changes };
}
