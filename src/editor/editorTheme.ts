/**
 * editorTheme.ts — CSS-стили для ProseMirror-редактора
 */

export function getEditorStyles(): string {
  return `
/* ==========================================
   Базовые стили ProseMirror
   ========================================== */

.ProseMirror {
  font-family: 'Inter', 'SF Pro Text', -apple-system, sans-serif;
  font-size: 15px;
  line-height: 1.75;
  color: #e1e1e3;
  padding: 24px 48px;
  max-width: 860px;
  margin: 0 auto;
  outline: none;
  min-height: 100%;
  caret-color: #6c8cff;
}

.ProseMirror ::selection {
  background: rgba(108, 140, 255, 0.2);
}

.ProseMirror p {
  margin: 0 0 0.5em 0;
}

/* ==========================================
   Заголовки (обычные <h1>–<h6> теги от ProseMirror)
   ========================================== */

.ProseMirror h1 { font-size: 2em; font-weight: 700; color: #e8eaed; line-height: 1.3; margin: 1em 0 0.4em 0; }
.ProseMirror h2 { font-size: 1.5em; font-weight: 650; color: #e8eaed; line-height: 1.35; margin: 0.8em 0 0.3em 0; }
.ProseMirror h3 { font-size: 1.25em; font-weight: 600; color: #d2d4d7; line-height: 1.4; margin: 0.7em 0 0.3em 0; }
.ProseMirror h4 { font-size: 1.1em; font-weight: 600; color: #c0c3c8; line-height: 1.45; margin: 0.6em 0 0.3em 0; }
.ProseMirror h5 { font-size: 1.05em; font-weight: 600; color: #b0b3b8; line-height: 1.5; margin: 0.5em 0 0.2em 0; }
.ProseMirror h6 { font-size: 1em; font-weight: 600; color: #9ca0a8; line-height: 1.5; margin: 0.5em 0 0.2em 0; }

/* Seamless prefix (# , ## , etc.) — показывается через виджет-декорацию */
.pm-heading-prefix {
  color: #4a4d54;
  font-weight: 400;
  font-size: 0.65em;
  user-select: none;
  pointer-events: none;
  margin-right: 2px;
}

/* ==========================================
   Inline стили
   ========================================== */

.ProseMirror strong {
  font-weight: 700;
  color: #f0f0f2;
}

.ProseMirror em {
  font-style: italic;
  color: #c8cad0;
}

.ProseMirror code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  background: rgba(108, 140, 255, 0.1);
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 0.88em;
  color: #8ca8ff;
}

/* Seamless mark syntax (**,  *, \`) */
.pm-mark-syntax {
  color: #4a4d54;
  font-weight: 400;
  font-style: normal;
  font-family: 'Inter', sans-serif;
  font-size: 0.85em;
  user-select: none;
  pointer-events: none;
}

/* ==========================================
   Горизонтальная линия
   ========================================== */

.ProseMirror hr {
  border: none;
  border-top: 1px solid #3a3d44;
  margin: 16px 0;
}

/* ==========================================
   Таблицы
   ========================================== */

.ProseMirror table {
  border-collapse: separate;
  border-spacing: 0;
  width: 100%;
  margin: 12px 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #2d2e32;
  table-layout: auto;
}

.ProseMirror th,
.ProseMirror td {
  padding: 8px 16px;
  border-bottom: 1px solid #232428;
  border-right: 1px solid #232428;
  vertical-align: top;
  position: relative;
}

.ProseMirror th:last-child,
.ProseMirror td:last-child {
  border-right: none;
}

.ProseMirror tbody tr:last-child td {
  border-bottom: none;
}

.ProseMirror th {
  background: #1e2025;
  font-weight: 600;
  color: #e8eaed;
  border-bottom: 2px solid #2d2e32;
}

.ProseMirror td {
  background: rgba(30, 32, 37, 0.3);
  color: #c8cad0;
}

.ProseMirror tbody tr:nth-child(even) td {
  background: rgba(30, 32, 37, 0.5);
}

.ProseMirror .selectedCell::after {
  z-index: 2;
  position: absolute;
  content: "";
  left: 0; right: 0; top: 0; bottom: 0;
  background: rgba(108, 140, 255, 0.15);
  pointer-events: none;
}

.ProseMirror .column-resize-handle {
  position: absolute;
  right: -2px; top: 0; bottom: 0;
  width: 4px;
  z-index: 20;
  background-color: #6c8cff;
  pointer-events: auto;
  cursor: col-resize;
}

.ProseMirror th p,
.ProseMirror td p {
  margin: 0;
}

/* ==========================================
   Gap Cursor
   ========================================== */

.ProseMirror .ProseMirror-gapcursor {
  position: relative;
}

.ProseMirror .ProseMirror-gapcursor::after {
  content: "";
  display: block;
  position: absolute;
  top: -2px;
  width: 20px;
  border-top: 2px solid #6c8cff;
  animation: ProseMirror-cursor-blink 1.1s steps(2, start) infinite;
}

@keyframes ProseMirror-cursor-blink {
  to { visibility: hidden; }
}
`
}
