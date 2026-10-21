'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, Check, ChevronDown, CircleHelp, Columns3, Download, FileImage, FileText, Folder, GripVertical, LayoutDashboard, LoaderCircle, MoreHorizontal, Plus, Search, Settings2, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { boardHeight, cardHeight, CARD_WIDTH, clampPosition, COLUMN_WIDTH, columnColors, HEADER_HEIGHT, priorities, type Board, type Card, type Column, type Priority } from '@/lib/board';

type Editor = { kind: 'board'; board?: Board } | { kind: 'column'; column?: Column } | { kind: 'card'; card?: Card; x?: number; y?: number } | { kind: 'delete-board'; boardId: string } | { kind: 'help' } | null;
type SaveState = 'saved' | 'pending' | 'saving' | 'error';
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'No se pudo completar la operación.'); }
  return response.status === 204 ? undefined as T : response.json();
}
function formatDate(date: string) { return date ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)) : 'Sin definir'; }
function download(url: string, name: string) { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }

export default function Workspace() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeId, setActiveId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [editor, setEditor] = useState<Editor>(null);
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const [readyDownload, setReadyDownload] = useState<{ url: string; name: string } | null>(null);
  const [exportMenu, setExportMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const canvasScroller = useRef<HTMLDivElement>(null);
  const boardsRef = useRef(boards);
  boardsRef.current = boards;
  const dirty = useRef(new Map<string, Board>());
  const revisions = useRef(new Map<string, number>());
  const saving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const board = boards.find(b => b.id === activeId);
  const boardToDelete = editor?.kind === 'delete-board' ? boards.find(b => b.id === editor.boardId) : undefined;
  useEffect(() => { if (board && canvasScroller.current) setZoom(Math.max(0.2, Math.min(1, canvasScroller.current.clientWidth / (board.columns.length * COLUMN_WIDTH)))); }, [board?.id, board?.columns.length]);

  const persist = useCallback(async () => {
    if (saving.current) return;
    saving.current = true;
    setSaveState('saving');
    try {
      while (dirty.current.size) {
        const [id, snapshot] = dirty.current.entries().next().value!;
        const saved = await api<Board>(`/api/boards/${id}`, { method: 'PUT', body: JSON.stringify({ ...snapshot, revision: revisions.current.get(id) ?? snapshot.revision }) });
        revisions.current.set(id, saved.revision);
        if (dirty.current.get(id) === snapshot) dirty.current.delete(id);
      }
      setSaveState('saved'); setError('');
    } catch (e) { setSaveState('error'); setError((e as Error).message); }
    finally { saving.current = false; }
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const data = await api<Board[]>('/api/boards');
      setBoards(data); setActiveId(data[0]?.id ?? '');
      revisions.current = new Map(data.map(b => [b.id, b.revision]));
    } catch (e) { setLoadError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => { if (dirty.current.size) { e.preventDefault(); } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { window.removeEventListener('beforeunload', beforeUnload); if (timer.current) clearTimeout(timer.current); };
  }, []);

  function update(next: Board) {
    if (timer.current) clearTimeout(timer.current);
    setBoards(current => current.map(b => b.id === next.id ? next : b));
    dirty.current.set(next.id, next);
    setSaveState('pending');
    timer.current = setTimeout(() => void persist(), 650);
  }
  function selectBoard(id: string) { setActiveId(id); setQuery(''); setSidebar(false); setReadyDownload(null); }
  function backup() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(boardsRef.current, null, 2)], { type: 'application/json' }));
    download(url, 'kanba-respaldo.json'); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function submitEditor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!editor) return;
    const values = new FormData(e.currentTarget);
    setBusy(true); setError('');
    try {
      const textField = editor.kind === 'board' ? 'title' : editor.kind === 'column' ? 'name' : editor.kind === 'card' ? 'name' : null;
      if (textField && !String(values.get(textField) ?? '').trim()) throw new Error('Escribe un texto antes de guardar.');
      if (editor.kind === 'board') {
        const title = String(values.get('title')).trim();
        const details = { title, goal: String(values.get('goal') ?? ''), iteration: String(values.get('iteration') ?? ''), startDate: String(values.get('startDate') ?? ''), endDate: String(values.get('endDate') ?? '') };
        if (details.startDate && details.endDate && details.startDate > details.endDate) throw new Error('La fecha de fin debe ser igual o posterior a la fecha de inicio.');
        if (editor.board && board) update({ ...board, ...details });
        else {
          const created = await api<Board>('/api/boards', { method: 'POST', body: JSON.stringify({ ...details, template: values.get('template') === 'on' }) });
          setBoards(current => [...current, created]); revisions.current.set(created.id, created.revision); selectBoard(created.id);
        }
      }
      if (editor.kind === 'column' && board) {
        const name = String(values.get('name')).trim(), color = String(values.get('color'));
        const columns = editor.column ? board.columns.map(c => c.id === editor.column!.id ? { ...c, name, color } : c) : [...board.columns, { id: crypto.randomUUID(), name, color, position: board.columns.length }];
        update({ ...board, columns });
      }
      if (editor.kind === 'card' && board) {
        const card: Card = { id: editor.card?.id ?? crypto.randomUUID(), code: String(values.get('code') ?? '').trim(), name: String(values.get('name')).trim(), description: String(values.get('description') ?? '').trim(), priority: String(values.get('priority')) as Priority, x: editor.card?.x ?? editor.x ?? 16, y: editor.card?.y ?? editor.y ?? 94 };
        update({ ...board, cards: editor.card ? board.cards.map(c => c.id === card.id ? card : c) : [...board.cards, card] });
      }
      if (editor.kind === 'delete-board') {
        const target = boardsRef.current.find(b => b.id === editor.boardId);
        if (!target) throw new Error('El tablero ya no está disponible.');
        if (timer.current) clearTimeout(timer.current);
        await persist();
        if (dirty.current.size) throw new Error('Guarda o respalda los cambios pendientes antes de eliminar el tablero.');
        await api(`/api/boards/${target.id}`, { method: 'DELETE' });
        dirty.current.delete(target.id); revisions.current.delete(target.id);
        const remaining = boardsRef.current.filter(b => b.id !== target.id);
        setBoards(remaining);
        if (activeId === target.id) selectBoard(remaining[0]?.id ?? '');
      }
      setEditor(null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function removeColumn(column: Column) {
    if (!board || board.columns.length <= 1) return;
    const index = column.position;
    const columns = board.columns.filter(c => c.id !== column.id).map((c, position) => ({ ...c, position }));
    // Preserve cards from the removed column and translate cards to its right.
    const cards = board.cards.map(c => ({ ...c, ...clampPosition(c.x >= (index + 1) * COLUMN_WIDTH ? c.x - COLUMN_WIDTH : c.x, c.y, columns.length) }));
    update({ ...board, columns, cards }); setEditor(null);
  }
  function reorderColumn(column: Column, delta: number) {
    if (!board) return;
    const target = column.position + delta;
    if (target < 0 || target >= board.columns.length) return;
    const columns = [...board.columns]; [columns[column.position], columns[target]] = [columns[target], columns[column.position]];
    const cards = board.cards.map(c => {
      const col = Math.floor((c.x + CARD_WIDTH / 2) / COLUMN_WIDTH);
      return { ...c, x: col === column.position ? c.x + delta * COLUMN_WIDTH : col === target ? c.x - delta * COLUMN_WIDTH : c.x };
    }).map(c => ({ ...c, ...clampPosition(c.x, c.y, columns.length) }));
    update({ ...board, columns: columns.map((c, position) => ({ ...c, position })), cards }); setEditor(null);
  }
  async function exportBoard(format: 'png' | 'pdf') {
    if (!board || !exportRef.current || exporting) return;
    setExporting(true); setExportMenu(false); setError(''); setReadyDownload(null);
    try {
      await document.fonts.ready;
      const { toPng } = await import('html-to-image');
      const node = exportRef.current;
      const width = node.scrollWidth, height = node.scrollHeight;
      const pixelRatio = Math.min(2, Math.sqrt(32_000_000 / (width * height)));
      const png = await toPng(node, { backgroundColor: '#FFFFFF', pixelRatio, width, height, cacheBust: true, skipFonts: true });
      const name = board.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-]+/g, '-').toLowerCase() || 'tablero';
      if (format === 'png') { setReadyDownload({ url: png, name: `${name}.png` }); download(png, `${name}.png`); }
      else {
        const { jsPDF } = await import('jspdf');
        const w = width * 0.264583, h = height * 0.264583;
        const doc = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'mm', format: [w, h], compress: true });
        doc.addImage(png, 'PNG', 0, 0, w, h); const url = doc.output('datauristring'); setReadyDownload({ url, name: `${name}.pdf` }); download(url, `${name}.pdf`);
      }
    } catch (e) { console.error(e); setError('No se pudo exportar el tablero. Inténtalo de nuevo o reduce el número de tarjetas.'); }
    finally { setExporting(false); }
  }
  const newCard = () => {
    if (!board) return;
    const first = board.cards.filter(c => c.x < COLUMN_WIDTH);
    const y = Math.max(94, ...first.map(c => c.y + cardHeight(c) + 20));
    setEditor({ kind: 'card', x: 16, y: Math.min(10000, y) });
  };
  const visibleCards = board?.cards.filter(c => `${c.code} ${c.name} ${c.description}`.toLowerCase().includes(query.toLowerCase())) ?? [];

  return <div className="app-shell">
    <aside className={`sidebar ${sidebar ? 'is-open' : ''}`}>
      <a className="brand" href="/" aria-label="Kanba, inicio"><span className="brand-mark"><Columns3 size={21}/></span>kanba<span className="brand-dot">.</span></a>
      <div className="workspace-label"><span className="avatar">T</span><div><strong>Mi espacio de trabajo</strong><small>Proyecto de investigación</small></div></div>
      <div className="nav-section"><span>ESPACIO PERSONAL</span></div>
      <button className="nav-item nav-active" onClick={() => setSidebar(false)}><LayoutDashboard size={17}/> Mis tableros <span className="nav-count">{boards.length}</span></button>
      <div className="nav-section board-list-heading"><span>TUS TABLEROS</span><button title="Crear tablero" aria-label="Crear tablero" onClick={() => setEditor({ kind: 'board' })}><Plus size={16}/></button></div>
      <nav className="board-list" aria-label="Tableros">{boards.map(b => <div key={b.id} className="board-nav-row"><button className={`board-nav ${activeId === b.id ? 'selected' : ''}`} onClick={() => selectBoard(b.id)}><span className="board-nav-dot"/><span>{b.title}</span>{activeId === b.id && <span className="selected-indicator"/>}</button><button className="delete-board-button" aria-label={`Eliminar tablero ${b.title}`} title={`Eliminar tablero ${b.title}`} onClick={() => { setError(''); setEditor({ kind: 'delete-board', boardId: b.id }); }}><Trash2 size={14}/></button></div>)}</nav>
      <button className="new-board-link" onClick={() => setEditor({ kind: 'board' })}><Plus size={16}/> Nuevo tablero</button>
      <div className="sidebar-bottom"><div className="research-note"><span className="note-icon"><FileText size={18}/></span><strong>Del tablero a tu tesis.</strong><p>Organiza tus ideas y exporta tu proceso en un solo lugar.</p><span>HECHO PARA INVESTIGAR <span>↗</span></span></div><button className="help-link" onClick={() => setEditor({ kind: 'help' })}><CircleHelp size={17}/> Guía rápida <span>↗</span></button><div className="profile"><span className="profile-avatar">MI</span><div><strong>Mi investigación</strong><small>Espacio personal</small></div><span className="online-dot"/></div></div>
    </aside>
    {sidebar && <button className="sidebar-overlay" aria-label="Cerrar menú" onClick={() => setSidebar(false)}/>}
    <main className="main">
      <header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-button" aria-label="Abrir menú" onClick={() => setSidebar(true)}><Columns3 size={18}/></button><Folder size={15}/><span>Mi espacio</span><span className="breadcrumb-slash">/</span><strong>Mis tableros</strong></div><div className="topbar-right"><span className={`save-status ${saveState}`} role="status">{saveState === 'saving' ? <LoaderCircle size={13} className="spin"/> : saveState === 'saved' ? <Check size={13}/> : <span className="status-dot"/>}{({ saved: 'Todos los cambios guardados', saving: 'Guardando…', pending: 'Cambios pendientes', error: 'No se pudo guardar' })[saveState]}</span><span className="personal-pill">Personal</span></div></header>
      <div className="page-content">
        {error && <div className="error-banner" role="alert"><span>{error}</span>{saveState === 'error' && <><button onClick={() => void persist()}>Reintentar</button><button onClick={backup}>Copia JSON</button></>}<button aria-label="Cerrar aviso" onClick={() => setError('')}><X size={16}/></button></div>}
        {loading ? <div className="empty-state"><LoaderCircle className="spin" size={28}/><h2>Preparando tu espacio…</h2></div> : loadError ? <div className="empty-state"><Columns3 size={36}/><h2>Conectemos tu espacio</h2><p>{loadError}</p><code>yarn db:local · yarn db:migrate</code><button className="button primary" onClick={() => void load()}>Reintentar conexión</button></div> : !board ? <div className="empty-state"><span className="empty-mark"><Columns3 size={36}/></span><span className="eyebrow">TU INVESTIGACIÓN EMPIEZA AQUÍ</span><h1>Un espacio para avanzar.</h1><p>Crea tu primer tablero y dale forma a tu proceso.</p><button className="button primary" onClick={() => setEditor({ kind: 'board' })}><Plus size={16}/> Crear mi primer tablero</button></div> : <>
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> ORGANIZA. VISUALIZA. AVANZA.</div><h1>{board.title}<button className="title-edit icon-button" aria-label="Editar información del tablero" onClick={() => setEditor({ kind: 'board', board })}><Settings2 size={18}/></button></h1><p className="subtitle">Cada idea en su lugar. Cada paso, un poco más cerca.</p></div><div className="heading-actions"><div className="export-dropdown"><button className="button secondary" onClick={() => setExportMenu(v => !v)} disabled={exporting} aria-expanded={exportMenu}>{exporting ? <LoaderCircle className="spin" size={16}/> : <ArrowDownToLine size={16}/>} {exporting ? 'Exportando…' : 'Exportar tablero'}<ChevronDown size={14}/></button>{exportMenu && <><button className="menu-backdrop" aria-label="Cerrar exportación" onClick={() => setExportMenu(false)}/><div className="dropdown-menu"><span>DESCARGAR TABLERO COMPLETO</span><button onClick={() => void exportBoard('png')}><FileImage size={17}/><div><strong>Imagen PNG</strong><small>Alta resolución para tu tesis</small></div></button><button onClick={() => void exportBoard('pdf')}><FileText size={17}/><div><strong>Documento PDF</strong><small>Una página con todo el tablero</small></div></button></div></>}</div><button className="button primary" onClick={newCard} disabled={board.cards.length >= 300}><Plus size={17}/> Nueva tarjeta</button></div></div>
          <section className="board-meta" aria-label="Información del tablero"><div className="meta-icon"><Columns3 size={21}/></div><button className="meta-field" onClick={() => setEditor({ kind: 'board', board })}><span>ITERACIÓN</span><strong>{board.iteration || 'Sin definir'}</strong></button><span className="meta-divider"/><button className="meta-field meta-goal" onClick={() => setEditor({ kind: 'board', board })}><span>OBJETIVO DEL TABLERO</span><strong>{board.goal || 'Añade un objetivo a tu tablero'}</strong></button><span className="meta-divider"/><button className="meta-field meta-date" onClick={() => setEditor({ kind: 'board', board })}><span>FECHA DE INICIO</span><strong>{formatDate(board.startDate)}</strong></button><span className="meta-divider"/><button className="meta-field meta-date" onClick={() => setEditor({ kind: 'board', board })}><span>FECHA DE FIN</span><strong>{formatDate(board.endDate)}</strong></button><span className="template-badge">{board.columns.length} etapas · {board.cards.length} tarjetas</span></section>
          <section className="board-panel"><div className="board-toolbar"><div className="view-tab"><Columns3 size={16}/> Vista de tablero <span>{board.cards.length}</span></div><div className="toolbar-actions"><label className="search-box"><Search size={15}/><input aria-label="Buscar tarjetas" placeholder="Buscar tarjeta…" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button aria-label="Limpiar búsqueda" onClick={() => setQuery('')}><X size={13}/></button>}</label><span className="toolbar-divider"/><button className="text-button" onClick={() => setEditor({ kind: 'column' })} disabled={board.columns.length >= 20}><Plus size={15}/> Añadir columna</button></div></div>
            <div className="canvas-scroll" ref={canvasScroller}><div className="scaled-space" style={{ width: board.columns.length * COLUMN_WIDTH * zoom, height: boardHeight(board.cards) * zoom }}><div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: board.columns.length * COLUMN_WIDTH }}><BoardCanvas board={{ ...board, cards: visibleCards }} height={boardHeight(board.cards)} zoom={zoom} onMove={(id, x, y) => { const latest = boardsRef.current.find(b => b.id === board.id); if (latest) update({ ...latest, cards: latest.cards.map(c => c.id === id ? { ...c, x, y } : c) }); }} onEdit={card => setEditor({ kind: 'card', card })} onColumn={column => setEditor({ kind: 'column', column })} onAdd={column => { const cards = board.cards.filter(c => Math.floor((c.x + CARD_WIDTH / 2) / COLUMN_WIDTH) === column.position); setEditor({ kind: 'card', x: column.position * COLUMN_WIDTH + 16, y: Math.min(10000, Math.max(94, ...cards.map(c => c.y + cardHeight(c) + 20))) }); }}/></div></div></div>
            <footer className="board-footer"><span><GripVertical size={14}/> Arrastra las tarjetas libremente en cualquier dirección</span><div className="zoom-control"><button title="Ajustar todo el tablero" onClick={() => { if (canvasScroller.current) setZoom(Math.max(0.2, Math.min(1, canvasScroller.current.clientWidth / (board.columns.length * COLUMN_WIDTH)))); }}>Ajustar</button><button title="Alejar" aria-label="Alejar" disabled={zoom <= 0.2} onClick={() => setZoom(v => Math.max(0.2, v - 0.1))}><ZoomOut size={15}/></button><button title="Restablecer zoom" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button><button title="Acercar" aria-label="Acercar" disabled={zoom >= 1.5} onClick={() => setZoom(v => Math.min(1.5, v + 0.1))}><ZoomIn size={15}/></button></div></footer>
          </section>
          {readyDownload && <div className="download-ready" role="status"><Check size={15}/><span>Tu archivo está listo.</span><a href={readyDownload.url} download={readyDownload.name}>Descargar {readyDownload.name.endsWith(".pdf") ? "PDF" : "PNG"}</a><button aria-label="Cerrar descarga" onClick={() => setReadyDownload(null)}><X size={14}/></button></div>}
          <div className="below-board"><div className="priority-legend"><span>PRIORIDAD</span>{Object.entries(priorities).map(([key, p]) => <span key={key}><i style={{ background: p.dot }}/>{p.label}</span>)}</div><span className="quiet-note">Un proceso claro también cuenta una historia.</span></div>
          <div className="offscreen-export" aria-hidden="true" inert><div ref={exportRef} className="export-sheet" style={{ width: board.columns.length * COLUMN_WIDTH + 64 }}><div className="export-heading"><div><p>TABLERO KANBAN</p><h1>{board.title}</h1><span>{[board.iteration, board.goal, board.startDate && `Inicio: ${formatDate(board.startDate)}`, board.endDate && `Fin: ${formatDate(board.endDate)}`].filter(Boolean).join('  ·  ')}</span></div></div><BoardCanvas board={board} clean height={boardHeight(board.cards)} zoom={1}/><div className="export-legend">Prioridad: {Object.entries(priorities).map(([key, p]) => <span key={key}><i style={{ background: p.dot }}/>{p.label}</span>)}</div></div></div>
        </>}
      </div>
    </main>
    {editor && <Modal title={editor.kind === 'board' ? editor.board ? 'Detalles del tablero' : 'Un nuevo comienzo' : editor.kind === 'column' ? editor.column ? 'Editar columna' : 'Nueva columna' : editor.kind === 'card' ? editor.card ? 'Editar tarjeta' : 'Nueva tarjeta' : editor.kind === 'delete-board' ? 'Eliminar tablero' : 'Tu espacio, a tu manera'} onClose={() => { if (!busy) setEditor(null); }}>
      {editor.kind === 'help' ? <div className="help-content"><p><strong>1. Crea un tablero.</strong> Empieza con las seis columnas de la plantilla o con una columna vacía.</p><p><strong>2. Personaliza las etapas.</strong> Usa los tres puntos de cada columna para cambiar su nombre, color y orden.</p><p><strong>3. Mueve tus ideas.</strong> Arrastra las tarjetas en ambos ejes. Con el teclado, enfoca una tarjeta y usa las flechas; Mayús mueve de 20 en 20 píxeles. Doble clic o el lápiz abre la edición.</p><p><strong>4. Llévalo a tu tesis.</strong> Exporta a PNG o PDF. La descarga incluye todas las columnas y tarjetas, incluso si hay una búsqueda activa.</p><p>Los cambios se guardan automáticamente en PostgreSQL. Espera el indicador «Todos los cambios guardados» antes de cerrar.</p><button className="button primary" onClick={() => setEditor(null)}>Entendido</button></div> : <form onSubmit={submitEditor} key={editor.kind + ('card' in editor ? editor.card?.id : 'column' in editor ? editor.column?.id : '')}>
        {editor.kind === 'board' && <><p className="modal-intro">Dale un espacio propio a cada proyecto de investigación.</p><label className="form-label">Nombre del tablero<input name="title" required maxLength={100} defaultValue={editor.board?.title} placeholder="Ej. Iteración 01" autoFocus/></label><label className="form-label">Iteración<input name="iteration" maxLength={60} defaultValue={editor.board?.iteration} placeholder="Ej. IT-01"/></label><label className="form-label">Objetivo · módulo o módulos<input name="goal" maxLength={500} defaultValue={editor.board?.goal} placeholder="Ej. Gestión de usuarios"/></label><div className="date-fields"><label className="form-label">Fecha de inicio<input name="startDate" type="date" defaultValue={editor.board?.startDate}/></label><label className="form-label">Fecha de fin<input name="endDate" type="date" defaultValue={editor.board?.endDate}/></label></div>{!editor.board && <label className="template-option"><input name="template" type="checkbox" defaultChecked/><span><strong>Usar plantilla Kanban</strong><small>Pendiente, En desarrollo, Completada, Validada, Pruebas y Finalizada.</small></span></label>}</>}
        {editor.kind === 'column' && <><label className="form-label">Nombre de la columna<input name="name" required maxLength={60} defaultValue={editor.column?.name} placeholder="Ej. Revisión bibliográfica" autoFocus/></label><ColorPicker defaultValue={editor.column?.color ?? columnColors[(board?.columns.length ?? 0) % columnColors.length]}/>{editor.column && <div className="column-order"><span>Posición de la columna</span><button type="button" className="button secondary" disabled={editor.column.position === 0} onClick={() => reorderColumn(editor.column!, -1)}><ArrowLeft size={15}/> Izquierda</button><button type="button" className="button secondary" disabled={editor.column.position === (board?.columns.length ?? 0) - 1} onClick={() => reorderColumn(editor.column!, 1)}>Derecha <ArrowRight size={15}/></button></div>}</>}
        {editor.kind === 'card' && <><label className="form-label">Identificador<input name="code" maxLength={40} defaultValue={editor.card?.code} placeholder="Ej. ADM-01"/></label><label className="form-label">Nombre<input name="name" required maxLength={300} defaultValue={editor.card?.name} placeholder="Nombre de la tarea" autoFocus/></label><label className="form-label">Descripción<textarea name="description" maxLength={2000} rows={4} defaultValue={editor.card?.description} placeholder="Describe la tarea y su alcance…"/></label><fieldset className="priority-picker"><legend>Prioridad</legend>{Object.entries(priorities).map(([key, p]) => <label key={key} style={{ '--priority-bg': p.color, '--priority-ink': p.ink } as React.CSSProperties}><input type="radio" name="priority" value={key} defaultChecked={key === (editor.card?.priority ?? 'medium')}/><span><i style={{ background: p.dot }}/>{p.label}</span></label>)}</fieldset><p className="field-hint">Puedes mover la tarjeta libremente después de crearla.</p></>}
        {editor.kind === 'delete-board' && <p className="modal-intro">Se eliminará «{boardToDelete?.title}» con todo su contenido. Columnas: {boardToDelete?.columns.length}. Tarjetas: {boardToDelete?.cards.length}. Esta acción no se puede deshacer.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><div>{editor.kind === 'card' && editor.card && <button type="button" className="danger-link" onClick={() => { if (board) update({ ...board, cards: board.cards.filter(c => c.id !== editor.card!.id) }); setEditor(null); }}><Trash2 size={15}/> Eliminar</button>}{editor.kind === 'column' && editor.column && <button type="button" className="danger-link" disabled={board?.columns.length === 1} onClick={() => removeColumn(editor.column!)}><Trash2 size={15}/> Eliminar columna</button>}{editor.kind === 'board' && editor.board && <button type="button" className="danger-link" onClick={() => setEditor({ kind: 'delete-board', boardId: editor.board!.id })}><Trash2 size={15}/> Eliminar</button>}</div><button className="button secondary" type="button" disabled={busy} onClick={() => setEditor(null)}>Cancelar</button><button className={`button ${editor.kind === 'delete-board' ? 'danger' : 'primary'}`} type="submit" disabled={busy}>{busy && <LoaderCircle size={15} className="spin"/>}{editor.kind === 'delete-board' ? 'Eliminar tablero' : editor.kind === 'board' && !editor.board ? 'Crear tablero' : 'Guardar'}</button></div>
        {editor.kind === 'column' && editor.column && <p className="field-hint">Al eliminar una columna se conservan sus tarjetas.</p>}
      </form>}
    </Modal>}
  </div>;
}

function ColorPicker({ defaultValue }: { defaultValue: string }) {
  const [color, setColor] = useState(defaultValue);
  return <fieldset className="color-picker"><legend>Color de la columna</legend><div>{columnColors.map(c => <label key={c} title={c}><input type="radio" name="preset-color" value={c} checked={color === c} onChange={() => setColor(c)}/><span style={{ background: c }}>{color === c && <Check size={16}/>}</span></label>)}<label className="custom-color" title="Color personalizado"><input type="color" aria-label="Color personalizado" value={color} onChange={e => setColor(e.target.value)}/><Plus size={16}/></label></div><input type="hidden" name="color" value={color}/></fieldset>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className="modal" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) { const rect = e.currentTarget.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) onClose(); } }}><div className="modal-header"><h2>{title}</h2><button className="icon-button" aria-label="Cerrar diálogo" onClick={onClose}><X size={20}/></button></div>{children}</dialog>;
}

type CanvasProps = { board: Board; height: number; zoom: number; clean?: boolean; onMove?: (id: string, x: number, y: number) => void; onEdit?: (card: Card) => void; onColumn?: (col: Column) => void; onAdd?: (col: Column) => void };
function BoardCanvas({ board, height, zoom, clean = false, onMove, onEdit, onColumn, onAdd }: CanvasProps) {
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; x: number; y: number; moved: boolean } | null>(null);
  function pointerDown(e: ReactPointerEvent<HTMLElement>, card: Card) {
    if (clean || dragRef.current || e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: card.id, startX: e.clientX, startY: e.clientY, x: card.x, y: card.y, moved: false };
  }
  function pointerMove(e: ReactPointerEvent<HTMLElement>) {
    const d = dragRef.current; if (!d) return;
    if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) < 4 && !d.moved) return;
    d.moved = true;
    setDrag({ id: d.id, ...clampPosition(d.x + (e.clientX - d.startX) / zoom, d.y + (e.clientY - d.startY) / zoom, board.columns.length) });
  }
  function pointerUp(e: ReactPointerEvent<HTMLElement>) {
    const d = dragRef.current; if (!d) return;
    if (d.moved) { const pos = clampPosition(d.x + (e.clientX - d.startX) / zoom, d.y + (e.clientY - d.startY) / zoom, board.columns.length); onMove?.(d.id, pos.x, pos.y); }
    dragRef.current = null; setDrag(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }
  const canvasHeight = Math.max(height, drag ? drag.y + 400 : 0);
  return <div className={`kanban-canvas ${clean ? 'clean-canvas' : ''}`} style={{ width: board.columns.length * COLUMN_WIDTH, height: canvasHeight }}>
    {board.columns.map(col => <section className="kanban-column" key={col.id} style={{ left: col.position * COLUMN_WIDTH, width: COLUMN_WIDTH, background: `${col.color}12` }}><div className="column-header" style={{ background: col.color }}><span className="column-dot"/><h2>{col.name}</h2><span className="column-count">{board.cards.filter(c => Math.floor((c.x + CARD_WIDTH / 2) / COLUMN_WIDTH) === col.position).length}</span>{!clean && <button className="column-menu" aria-label={`Editar columna ${col.name}`} onClick={() => onColumn?.(col)}><MoreHorizontal size={17}/></button>}</div>{!clean && <button className="add-in-column" onClick={() => onAdd?.(col)} disabled={board.cards.length >= 300}><Plus size={14}/> Añadir tarjeta</button>}</section>)}
    {board.cards.map(card => {
      const p = priorities[card.priority]; const isDragging = drag?.id === card.id;
      return <article key={card.id} tabIndex={clean ? undefined : 0} aria-label={`${card.name}. Prioridad ${p.label}. Usa las flechas para mover y Enter para editar.`} aria-roledescription="Tarjeta movible" className={`kanban-card ${isDragging ? 'dragging' : ''}`} style={{ left: isDragging ? drag.x : card.x, top: isDragging ? drag.y : card.y, width: CARD_WIDTH, minHeight: cardHeight(card), background: p.color, borderColor: `${p.dot}35` }} onPointerDown={e => pointerDown(e, card)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { dragRef.current = null; setDrag(null); }} onLostPointerCapture={() => { dragRef.current = null; setDrag(null); }} onDoubleClick={() => onEdit?.(card)} onKeyDown={e => {
        if (e.target !== e.currentTarget || clean) return;
        if (e.key === 'Enter') { e.preventDefault(); onEdit?.(card); return; }
        const delta = e.shiftKey ? 20 : 5;
        const moves: Record<string, [number, number]> = { ArrowLeft: [-delta, 0], ArrowRight: [delta, 0], ArrowUp: [0, -delta], ArrowDown: [0, delta] };
        if (moves[e.key]) { e.preventDefault(); const [dx, dy] = moves[e.key]; const pos = clampPosition(card.x + dx, card.y + dy, board.columns.length); onMove?.(card.id, pos.x, pos.y); }
      }}><div className="card-topline"><span className="priority-label" style={{ color: p.ink }}><i style={{ background: p.dot }}/>{p.label}</span>{!clean && <button aria-label={`Editar tarjeta: ${card.name}`} onClick={() => onEdit?.(card)}><MoreHorizontal size={16}/></button>}</div><h3 className="card-name">{card.name}</h3>{card.description && <p className="card-description">{card.description}</p>}<div className="card-bottom"><span className="card-id">{card.code || `T-${String(board.cards.findIndex(c => c.id === card.id) + 1).padStart(2, '0')}`}</span>{!clean && <GripVertical size={13}/>}</div></article>;
    })}
  </div>;
}
