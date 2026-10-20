import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { makeTemplate } from '@/lib/board';
import { z } from 'zod';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const boards = await getPrisma().board.findMany({ orderBy: { createdAt: 'asc' }, include: { columns: { orderBy: { position: 'asc' } }, cards: true } });
    return NextResponse.json(boards);
  } catch (error) { console.error(error); return NextResponse.json({ error: 'No se pudo conectar a PostgreSQL. Comprueba DATABASE_URL y ejecuta las migraciones.' }, { status: 503 }); }
}
export async function POST(request: Request) {
  try {
    const parsed = z.object({ title: z.string().trim().min(1).max(100), template: z.boolean() }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Datos del tablero inválidos.' }, { status: 400 });
    const data = makeTemplate(false);
    if (!parsed.data.template) data.columns = data.columns.slice(0, 1).map(c => ({ ...c, name: 'Por hacer' }));
    const { columns, cards, ...metadata } = data;
    const board = await getPrisma().board.create({ data: { ...metadata, title: parsed.data.title, goal: '', sprint: '', columns: { create: columns }, cards: { create: cards } }, include: { columns: { orderBy: { position: 'asc' } }, cards: true } });
    return NextResponse.json(board, { status: 201 });
  } catch (error) { console.error(error); return NextResponse.json({ error: 'No se pudo crear el tablero.' }, { status: 500 }); }
}
