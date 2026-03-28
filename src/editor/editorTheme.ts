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
   Цитаты (Blockquote)
   ========================================== */

.ProseMirror blockquote {
  border-left: 4px solid #6c8cff;
  padding-left: 16px;
  margin: 16px 0;
  color: #a0a4ab;
  background: rgba(108, 140, 255, 0.05);
  padding-top: 8px;
  padding-bottom: 8px;
  border-radius: 0 4px 4px 0;
}

.ProseMirror blockquote p {
  margin-bottom: 0.5em;
  color: inherit;
}

.ProseMirror blockquote p:last-child {
  margin-bottom: 0;
}

/* ==========================================
   Списки и чекбоксы (Task lists)
   ========================================== */

.ProseMirror ul,
.ProseMirror ol {
  padding-left: 24px;
  margin: 8px 0;
}

.ProseMirror ul {
  list-style-type: disc;
}

.ProseMirror ol {
  list-style-type: decimal;
}

.ProseMirror li {
  margin-bottom: 4px;
  line-height: 1.6;
}

.ProseMirror li.task-list-item {
  list-style: none;
  position: relative;
  margin-left: -24px; /* Убираем отступ маркера для чекбокса */
  padding-left: 28px;
}

.ProseMirror li.task-list-item::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 4px;
  width: 16px;
  height: 16px;
  border: 1px solid #6c8cff;
  border-radius: 4px;
  background: transparent;
  display: inline-block;
  pointer-events: none; /* Пока не делаем интерактивным клик */
}

.ProseMirror li.task-list-item[data-checked="true"]::before {
  background: #6c8cff;
  border-color: #6c8cff;
}

/* Галочка (check) */
.ProseMirror li.task-list-item[data-checked="true"]::after {
  content: '';
  position: absolute;
  left: 9px;
  top: 6px;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
  pointer-events: none;
}

.ProseMirror li.task-list-item[data-checked="true"] > p {
  color: #7b7d85;
  text-decoration: line-through;
}

/* ==========================================
   Блоки кода
   ========================================== */

.code-block-wrapper {
  background: #1e1e1e; /* Темный фон Telegram */
  border-radius: 8px;
  margin: 16px 0;
  overflow: hidden;
  border: 1px solid #2d2e32;
  position: relative;
}

.code-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.05); /* Немного светлее фона */
  user-select: none;
}

.code-block-lang {
  color: #8bb4e7; /* Светло-голубой цвет языка */
  font-size: 12px;
  font-weight: 500;
  text-transform: lowercase;
}

.code-block-copy {
  background: none;
  border: none;
  color: #6a6e78;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.code-block-copy:hover {
  color: #a0a4ae;
  background: rgba(255, 255, 255, 0.1);
}

.code-block-copy .copied-text {
  font-size: 11px;
  color: #98c379;
}

.code-block-wrapper pre {
  margin: 0;
  padding: 12px;
  overflow-x: auto;
}

.code-block-content {
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 14px;
  line-height: 1.5;
  color: #e4e6eb;
}

.ProseMirror pre {
  background: transparent;
  padding: 0;
  margin: 0;
  border: none;
}

.ProseMirror pre code {
  color: inherit;
  padding: 0;
  background: none;
  border-radius: 0;
  font-family: inherit;
  font-size: inherit;
}

/* ==========================================
   Syntax Highlighting (Atom One Dark)
   ========================================== */

.ProseMirror .hljs-keyword,
.ProseMirror .hljs-selector-tag,
.ProseMirror .hljs-operator {
  color: #c678dd;
}

.ProseMirror .hljs-string,
.ProseMirror .hljs-meta .hljs-string,
.ProseMirror .hljs-doctag,
.ProseMirror .hljs-regexp {
  color: #98c379;
}

.ProseMirror .hljs-title,
.ProseMirror .hljs-section,
.ProseMirror .hljs-name,
.ProseMirror .hljs-selector-id,
.ProseMirror .hljs-selector-class {
  color: #e06c75;
}

.ProseMirror .hljs-number,
.ProseMirror .hljs-built_in,
.ProseMirror .hljs-literal,
.ProseMirror .hljs-type,
.ProseMirror .hljs-params,
.ProseMirror .hljs-variable,
.ProseMirror .hljs-template-variable,
.ProseMirror .hljs-link {
  color: #d19a66;
}

.ProseMirror .hljs-comment,
.ProseMirror .hljs-quote,
.ProseMirror .hljs-meta {
  color: #5c6370;
  font-style: italic;
}

.ProseMirror .hljs-attr,
.ProseMirror .hljs-attribute {
  color: #d19a66;
}

.ProseMirror .hljs-symbol,
.ProseMirror .hljs-bullet,
.ProseMirror .hljs-addition {
  color: #61aeee;
}

.ProseMirror .hljs-deletion {
  color: #e06c75;
}

/* ==========================================
   Math (KaTeX)
   ========================================== */

/* Inline Math */
.math-inline-wrapper {
  position: relative;
  display: inline-block;
  cursor: text;
}

.math-inline-prefix {
  color: #6a6e78;
  display: none;
}

.math-inline-editor {
  color: #c678dd;
  display: none;
  min-width: 10px;
}

.math-inline-render {
  display: inline-block;
}

/* При фокусе: показываем текст, показываем $ с двух сторон через CSS, и тултип снизу */
.math-inline-wrapper.is-active .math-inline-editor {
  display: inline-block;
}

.math-inline-wrapper.is-active .math-inline-prefix {
  display: inline;
}

.math-inline-wrapper.is-active::after {
  content: "$";
  color: #6a6e78;
}

.math-inline-wrapper.is-active .math-inline-render {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #232428;
  border: 1px solid #36373d;
  padding: 4px 8px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  z-index: 100;
  pointer-events: none;
  font-size: 1.1em;
  white-space: nowrap;
}

/* Block Math */
.math-block-wrapper {
  margin: 16px 0;
  border: 1px solid transparent;
  border-radius: 8px;
}

.math-block-editor-wrapper {
  background: #1e1e1e;
  border: 1px solid #2d2e32;
  border-radius: 8px 8px 0 0;
  padding: 12px;
  display: none;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  color: #c678dd;
  white-space: pre-wrap;
}

.math-block-preview-wrapper {
  background: transparent;
  padding: 12px;
  text-align: center;
  position: relative;
}

.math-block-preview-header {
  display: none;
  justify-content: space-between;
  align-items: center;
  background: #232428;
  padding: 6px 12px;
  font-size: 12px;
  color: #8bb4e7;
  border: 1px solid #2d2e32;
  border-top: none;
  border-radius: 0 0 8px 8px;
  margin: -12px -12px 12px -12px;
}

.math-btn-ok {
  background: none;
  border: none;
  color: #98c379;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}
.math-btn-ok:hover {
  background: rgba(152, 195, 121, 0.1);
}

.math-block-wrapper.is-active .math-block-editor-wrapper {
  display: block;
}

.math-block-wrapper.is-active .math-block-preview-header {
  display: flex;
}

.math-block-wrapper.is-active .math-block-preview-wrapper {
  background: rgba(255, 255, 255, 0.02);
  border: 1px dashed #36373d;
  border-top: none;
  border-radius: 0 0 8px 8px;
}

/* ==========================================
   Tooltips (Ссылки и Изображения)
   ========================================== */

.pm-tooltip {
  position: absolute;
  z-index: 1000;
  background: #232428;
  border: 1px solid #36373d;
  border-radius: 6px;
  padding: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.pm-tooltip-input {
  background: #1e1f22;
  border: 1px solid #4a4b53;
  color: #e4e6eb;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
  outline: none;
  min-width: 250px;
  display: block;
}

.pm-tooltip-input:focus {
  border-color: #5865f2;
}

/* ==========================================
   Изображения и Ссылки
   ========================================== */
.ProseMirror img {
  max-width: 100%;
  border-radius: 6px;
  margin: 12px 0;
  cursor: pointer;
  border: 1px solid transparent;
}

.ProseMirror img.ProseMirror-selectednode {
  border-color: #5865f2;
}

.ProseMirror a {
  color: #5865f2;
  text-decoration: none;
  cursor: text;
}

.ProseMirror a:hover {
  text-decoration: underline;
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

.ProseMirror s {
  text-decoration: line-through;
  color: #7b7d85;
}

.ProseMirror mark {
  background: rgba(255, 215, 0, 0.2);
  color: #ffd700;
  border-radius: 3px;
  padding: 0 2px;
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
