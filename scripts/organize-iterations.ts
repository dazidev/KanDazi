import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { boardSchema, type Board } from '../src/lib/board';
import { organizeCarryovers } from '../src/lib/iteration-carryover';

if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL en .env.');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  const saved = await db.board.findMany({ include: { columns: { orderBy: { position: 'asc' } }, cards: { orderBy: [{ y: 'asc' }, { x: 'asc' }] } } });
  const input: Board[] = saved.map(board => ({ ...boardSchema.parse(board), id: board.id, revision: board.revision, updatedAt: board.updatedAt.toISOString() }));
  const plan = organizeCarryovers(input);
  const changedIds = new Set(plan.changes.map(change => change.boardId));
  for (const board of plan.boards) boardSchema.parse(board);
  const createdColumns = plan.boards.reduce((total, board, index) => total + board.columns.length - input[index].columns.length, 0);
  console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'preview', boards: input.length, movedCards: plan.changes.length, createdColumns, changes: plan.changes }, null, 2));
  if (process.argv.includes('--apply') && changedIds.size) {
    await mkdir('.data/backups', { recursive: true });
    const backup = `.data/backups/before-carryover-${Date.now()}.json`;
    await writeFile(backup, JSON.stringify(saved, null, 2), { mode: 0o600 });
    await db.$transaction(async tx => {
      for (const board of plan.boards.filter(candidate => changedIds.has(candidate.id))) {
        const previous = input.find(candidate => candidate.id === board.id)!;
        const result = await tx.board.updateMany({ where: { id: board.id, revision: previous.revision }, data: { revision: { increment: 1 } } });
        if (result.count !== 1) throw new Error(`${board.title} cambió durante la revisión. Vuelve a ejecutar el comando.`);
        for (const column of board.columns.filter(column => !previous.columns.some(before => before.id === column.id))) {
          await tx.column.create({ data: { ...column, boardId: board.id } });
        }
        for (const change of plan.changes.filter(change => change.boardId === board.id)) {
          const card = board.cards.find(card => card.id === change.cardId)!;
          await tx.card.update({ where: { id: card.id }, data: { x: card.x, y: card.y } });
        }
      }
    }, { timeout: 60000 });
    console.log(`Organización aplicada. Respaldo: ${backup}`);
  }
} finally { await db.$disconnect(); }
