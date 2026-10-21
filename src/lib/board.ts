import { z } from 'zod';
export const COLUMN_WIDTH = 260;
export const CARD_WIDTH = 228;
export const CARD_HEIGHT = 112;
export const HEADER_HEIGHT = 68;
export const MIN_HEIGHT = 610;
export const priorities = {
  low: { label: 'Baja', color: '#E2F1E8', ink: '#337452', dot: '#5E9A76' },
  medium: { label: 'Media', color: '#FFF1CB', ink: '#926A1B', dot: '#D6A33E' },
  high: { label: 'Alta', color: '#FBE3DF', ink: '#A4493D', dot: '#D26E5F' },
} as const;
export type Priority = keyof typeof priorities;
export const columnColors = ['#DBE8F5', '#F9EDC9', '#F6DED6', '#E6DFF4', '#E0EBD9', '#E5E9EC', '#D6EBEA', '#F3DDED'];
const columnSchema = z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(60), color: z.string().regex(/^#[a-fA-F0-9]{6}$/), position: z.number().int().min(0).max(19) });
const dateSchema = z.union([z.literal(''), z.iso.date()]);
const cardSchema = z.object({ id: z.string().uuid(), code: z.string().trim().max(40).default(''), name: z.string().trim().min(1).max(300), description: z.string().trim().max(2000), priority: z.enum(['low', 'medium', 'high']), x: z.number().finite().min(0), y: z.number().finite().min(HEADER_HEIGHT).max(10000) });
export const boardDetailsSchema = z.object({
  title: z.string().trim().min(1).max(100), goal: z.string().max(500), iteration: z.string().max(60), startDate: dateSchema, endDate: dateSchema,
});
export const boardSchema = boardDetailsSchema.extend({
  columns: z.array(columnSchema).min(1).max(20), cards: z.array(cardSchema).max(300),
}).superRefine((board, ctx) => {
  if (board.startDate && board.endDate && board.startDate > board.endDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'La fecha de fin debe ser igual o posterior a la fecha de inicio.' });
  if (new Set(board.columns.map(c => c.id)).size !== board.columns.length || new Set(board.cards.map(c => c.id)).size !== board.cards.length) ctx.addIssue({ code: 'custom', message: 'Identificadores repetidos' });
  if (board.columns.some((c, i) => c.position !== i)) ctx.addIssue({ code: 'custom', message: 'Orden de columnas inválido' });
  if (board.cards.some(c => c.x > board.columns.length * COLUMN_WIDTH - CARD_WIDTH)) ctx.addIssue({ code: 'custom', message: 'Tarjeta fuera del tablero' });
});
export type BoardData = z.infer<typeof boardSchema>;
export type Board = BoardData & { id: string; revision: number; updatedAt: string };
export type Card = BoardData['cards'][number];
export type Column = BoardData['columns'][number];
export function cardHeight(card: Pick<Card, 'name' | 'description'>) {
  const lines = (text: string, width: number) => text ? text.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(line.length / width)), 0) : 0;
  return Math.max(CARD_HEIGHT, 78 + lines(card.name, 22) * 20 + lines(card.description, 28) * 18);
}
export function boardHeight(cards: Card[]) { return Math.max(MIN_HEIGHT, ...cards.map(c => c.y + cardHeight(c) + 60)); }
export function clampPosition(x: number, y: number, columnCount: number) {
  return { x: Math.max(0, Math.min(columnCount * COLUMN_WIDTH - CARD_WIDTH, Math.round(x))), y: Math.max(HEADER_HEIGHT, Math.min(10000, Math.round(y))) };
}
export function makeTemplate(withExamples = true): BoardData {
  const names = ['Pendiente', 'En desarrollo', 'Completada', 'Validada', 'Pruebas', 'Finalizada'];
  const columns = names.map((name, position) => ({ id: crypto.randomUUID(), name, color: columnColors[position], position }));
  const examples: [string, Priority, number, number][] = [
    ['Definir los objetivos de investigación', 'high', 0, 94], ['Revisar la bibliografía', 'medium', 0, 224],
    ['Diseñar la metodología de trabajo', 'high', 1, 94], ['Organizar los instrumentos de recolección', 'low', 1, 224],
    ['Delimitar el problema de investigación', 'medium', 2, 94], ['Validar el enfoque metodológico', 'low', 3, 94],
    ['Realizar una prueba piloto', 'medium', 4, 94],
  ];
  return { title: 'Iteración 01', goal: '', iteration: 'IT-01', startDate: '', endDate: '', columns, cards: withExamples ? examples.map(([name, priority, col, y]) => ({ id: crypto.randomUUID(), code: '', name, description: '', priority, x: col * COLUMN_WIDTH + 16, y })) : [] };
}
