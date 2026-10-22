import { CARD_WIDTH, COLUMN_WIDTH, type Board, type Card } from './board';

export const EXPORT_CARD_WIDTH = 300;
const GAP = 10;
const lines = (text: string, length: number) => text ? text.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / length)), 0) : 0;
const estimatedHeight = (card: Card) => 60 + lines(card.name, 30) * 21 + lines(card.description, 36) * 20;

// The export is a reading layout, independent of the saved editing coordinates.
export function exportLayout(board: Pick<Board, 'columns' | 'cards'>) {
  const groups = board.columns.map(column => ({
    ...column,
    cards: board.cards.filter(card => Math.min(board.columns.length - 1, Math.max(0, Math.floor((card.x + CARD_WIDTH / 2) / COLUMN_WIDTH))) === column.position).sort((a, b) => a.y - b.y || a.x - b.x),
  }));
  const candidates = [1, 2, 3].map(limit => {
    const columns = groups.map(column => {
      const lanes = Math.max(1, Math.min(limit, column.cards.length));
      // Empty headers keep their full name, wrapping at words when necessary.
      const width = column.cards.length ? lanes * EXPORT_CARD_WIDTH + (lanes - 1) * GAP + 16 : Math.max(110, Math.min(240, Math.max(...column.name.split(/\s+/).map(word => word.length)) * 10 + 40));
      let height = 64;
      for (let index = 0; index < column.cards.length; index += lanes) height += Math.max(...column.cards.slice(index, index + lanes).map(estimatedHeight)) + GAP;
      return { ...column, lanes, width, estimatedHeight: height };
    });
    const width = Math.max(600, columns.reduce((sum, column) => sum + column.width, 0));
    const height = Math.max(120, ...columns.map(column => column.estimatedHeight)) + 110;
    return { columns, width, score: Math.abs(Math.log(width / height)) + width / 14000 };
  });
  return candidates.sort((a, b) => a.score - b.score)[0];
}
