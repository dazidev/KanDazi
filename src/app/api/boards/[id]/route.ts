import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { boardSchema } from '@/lib/board';
import { z } from 'zod';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = boardSchema.safeParse(body);
    const revision = z.number().int().nonnegative().safeParse(body.revision);
    if (!parsed.success || !revision.success) return NextResponse.json({ error: 'Datos inválidos. Revisa el texto, los colores y las posiciones.' }, { status: 400 });
    const { columns, cards, ...metadata } = parsed.data;
    const board = await getPrisma().$transaction(async tx => {
      const result = await tx.board.updateMany({ where: { id, revision: revision.data }, data: { ...metadata, revision: { increment: 1 } } });
      if (result.count === 0) throw new Error('CONFLICT');
      await tx.column.deleteMany({ where: { boardId: id } });
      await tx.card.deleteMany({ where: { boardId: id } });
      await tx.column.createMany({ data: columns.map(c => ({ ...c, boardId: id })) });
      if (cards.length) await tx.card.createMany({ data: cards.map(c => ({ ...c, boardId: id })) });
      return tx.board.findUniqueOrThrow({ where: { id }, include: { columns: { orderBy: { position: 'asc' } }, cards: true } });
    });
    return NextResponse.json(board);
  } catch (error) {
    if (error instanceof Error && error.message === 'CONFLICT') return NextResponse.json({ error: 'Este tablero cambió en otra pestaña. Descarga una copia JSON de tus cambios antes de recargar.' }, { status: 409 });
    console.error(error); return NextResponse.json({ error: 'No se pudo guardar. Tus cambios siguen en esta pestaña; vuelve a intentarlo.' }, { status: 500 });
  }
}
export async function DELETE(_request: Request, context: Context) {
  try { const { id } = await context.params; await getPrisma().board.delete({ where: { id } }); return new NextResponse(null, { status: 204 }); }
  catch (error) { console.error(error); return NextResponse.json({ error: 'No se pudo eliminar el tablero.' }, { status: 500 }); }
}
