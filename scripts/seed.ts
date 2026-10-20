import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { makeTemplate } from '../src/lib/board';
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
try {
  if (await db.board.count() === 0) {
    const { columns, cards, ...data } = makeTemplate();
    await db.board.create({ data: { ...data, columns: { create: columns }, cards: { create: cards } } });
    console.log('Tablero de ejemplo creado.');
  } else console.log('La base ya contiene tableros; no se modificó.');
} finally { await db.$disconnect(); }
