import { exportLayout } from '@/lib/export-layout';
import { priorities, type Board } from '@/lib/board';

const date = (value: string) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));

export default function BoardExport({ board }: { board: Board }) {
  const layout = exportLayout(board);
  return <div className="export-sheet" style={{ width: layout.width + 24 }}>
    <header className="export-heading"><h1>{board.title}</h1>
      {board.goal && <p className="export-modules">{board.goal}</p>}
      <p className="export-dates">{[board.iteration, board.startDate && `Inicio: ${date(board.startDate)}`, board.endDate && `Fin: ${date(board.endDate)}`].filter(Boolean).join(' · ')}</p>
    </header>
    <div className="export-columns" style={{ gridTemplateColumns: layout.columns.map(column => `${column.width}px`).join(' ') }}>
      {layout.columns.map(column => <section key={column.id} className={`export-column ${column.cards.length ? '' : 'empty'}`} style={{ background: `${column.color}18` }}>
        <h2 style={{ background: column.color }}>{column.name}<span>{column.cards.length}</span></h2>
        <div className="export-cards" style={{ gridTemplateColumns: `repeat(${column.lanes}, minmax(0, 1fr))` }}>
          {column.cards.map(card => {
            const priority = priorities[card.priority];
            return <article className="export-card" key={card.id} style={{ background: priority.color, borderColor: `${priority.dot}80` }}>
              <div className="export-card-labels"><span style={{ color: priority.ink }}>{priority.label}</span><span>{card.code || `T-${String(board.cards.findIndex(item => item.id === card.id) + 1).padStart(2, '0')}`}</span></div>
              <h3>{card.name}</h3>
            </article>;
          })}
        </div>
      </section>)}
    </div>
  </div>;
}
