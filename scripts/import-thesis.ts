import 'dotenv/config';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { z } from 'zod';
import { boardSchema } from '../src/lib/board';

// Stable identifiers in the data file make re-running this import safe:
// existing boards (including subsequent manual edits) are left intact.
const schema = z.object({
  source: z.string(),
  boards: z.array(z.object({ id: z.string().uuid(), data: boardSchema })).length(19),
});
const input = schema.parse(JSON.parse(await readFile(new URL('../data/thesis-iterations.json', import.meta.url), 'utf8')));
if (new Set(input.boards.map(board => board.id)).size !== 19 ||
    input.boards.some((board, index) => board.data.iteration !== `IT-${String(index + 1).padStart(2, '0')}`)) {
  throw new Error('La importación debe contener IT-01 a IT-19, en orden y con identificadores únicos.');
}
if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL en .env.');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  const existing = await db.board.findMany({ include: { columns: true, cards: true } });
  await mkdir('.data/backups', { recursive: true });
  await writeFile(`.data/backups/before-thesis-import-${Date.now()}.json`, JSON.stringify(existing, null, 2), { mode: 0o600 });
  const counts = await db.$transaction(async tx => {
    let created = 0;
    for (const { id, data } of input.boards) {
      const { columns, cards, ...metadata } = data;
      // Empty update deliberately preserves boards already imported.
      const before = await tx.board.findUnique({ where: { id }, select: { id: true } });
      await tx.board.upsert({ where: { id }, update: {}, create: {
        id, ...metadata, columns: { create: columns }, cards: { create: cards },
      } });
      if (!before) created++;
    }
    return { created, preserved: input.boards.length - created };
  }, { timeout: 60000 });
  console.log(JSON.stringify({ source: input.source, ...counts }));
} finally { await db.$disconnect(); }
