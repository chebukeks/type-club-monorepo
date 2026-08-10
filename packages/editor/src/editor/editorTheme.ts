/**
 * editorTheme.ts — CSS-стили для ProseMirror-редактора.
 * Все цвета через CSS-переменные для поддержки тем.
 */

export function getEditorStyles(): string {
  return `
/* ==========================================
   Базовые стили ProseMirror
   ========================================== */

.ProseMirror {
  font-family: 'Inter', 'SF Pro Text', -apple-system, sans-serif;
  font-size: var(--editor-font-size, 15px);
  line-height: 1.75;
  color: var(--editor-text);
  padding: 24px calc(48px * var(--doc-scale, 1));
  padding-bottom: 70vh;
  max-width: calc(860px * var(--doc-scale, 1));
  margin: 0 auto;
  outline: none;
  min-height: 100%;
  caret-color: var(--editor-caret);
  box-shadow: inset 1px 0 0 0 var(--border-subtle, rgba(128,128,128,0.12)), inset -1px 0 0 0 var(--border-subtle, rgba(128,128,128,0.12));

}

.typewriter-mode .ProseMirror {
  padding-top: 70vh;
  padding-bottom: 70vh;
}

.ProseMirror.preview-mode {
  padding-top: 24px;
  padding-bottom: 24px;
}

/* Нейтрализация внутрисепараторных <img> элементов ProseMirror в Chromium */
.ProseMirror-separator {
  display: inline !important;
  width: 0 !important;
  height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  vertical-align: baseline !important;
  line-height: 0 !important;
  font-size: 0 !important;
  pointer-events: none !important;
}

/* ==========================================
   Suggestion Mode Styles
/* ==========================================
   Режим предложений (Suggestion Mode)
   ========================================== */

.suggestion-insert {
  background-color: rgba(59, 130, 246, 0.15);
  color: var(--sug-color, #3b82f6);
  border-bottom: 2px solid var(--sug-color, #3b82f6);
  text-decoration: none;
  padding: 1px 2px;
  border-radius: 2px;
}

.suggestion-delete {
  background-color: rgba(239, 68, 68, 0.15);
  color: var(--sug-color, #ef4444);
  text-decoration: line-through;
  text-decoration-color: var(--sug-color, #ef4444);
  padding: 1px 2px;
  border-radius: 2px;
  opacity: 0.8;
}

.suggestion-note,
.suggestion-note-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  vertical-align: 1px;
  background: #fef3c7;
  color: #d97706;
  border: 1px solid #fde68a;
  border-radius: 50%;
  margin: 0 4px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  transition: transform 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
}

.suggestion-note svg,
.suggestion-note-badge svg {
  display: block;
  width: 13px;
  height: 13px;
}

.dark .suggestion-note,
.dark .suggestion-note-badge {
  background: rgba(120, 53, 15, 0.4);
  color: #fbbf24;
  border-color: rgba(180, 83, 9, 0.5);
}

.suggestion-note:hover,
.suggestion-note-badge:hover {
  transform: scale(1.15);
  background: #fde68a;
  box-shadow: 0 2px 8px rgba(217, 119, 6, 0.25);
}

/* Custom Speech Bubble Popover for Notes */
.suggestion-note-bubble {
  position: fixed;
  z-index: 99999;
  display: none;
  background: var(--bg-elevated, #ffffff);
  color: var(--text-primary, #111827);
  border: 1px solid var(--border-default, #e5e7eb);
  border-radius: 12px;
  padding: 8px 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08);
  max-width: 280px;
  min-width: 180px;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  animation: fadeInPop 0.12s ease-out;
}

.dark .suggestion-note-bubble {
  background: #1f2937;
  color: #f9fafb;
  border-color: #374151;
}

.suggestion-note-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border-subtle, #f3f4f6);
}

.dark .suggestion-note-header {
  border-bottom-color: #374151;
}

.suggestion-note-author {
  font-size: 11px;
  font-weight: 600;
  color: #d97706;
}

.dark .suggestion-note-author {
  color: #fbbf24;
}

.suggestion-note-delete-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: 4px;
  background: transparent;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.suggestion-note-delete-btn:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.suggestion-note-text {
  font-size: 12px;
  line-height: 1.45;
  color: inherit;
  word-break: break-word;
}

figure[data-sug-delete] {
  position: relative;
  outline: 2px dashed #ef4444;
  outline-offset: 4px;
  opacity: 0.7;
}

figure[data-sug-delete]::after {
  content: "Предложено удалить";
  position: absolute;
  top: 8px;
  right: 8px;
  background: #ef4444;
  color: white;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.suggestion-action-popup {
  position: fixed;
  z-index: 99999;
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-elevated, #ffffff);
  border: 1px solid var(--border-default, #e5e7eb);
  border-radius: 10px;
  padding: 5px 8px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  font-size: 12px;
  user-select: none;
  animation: fadeInPop 0.12s ease-out;
}

.dark .suggestion-action-popup {
  background: #1f2937;
  border-color: #374151;
}

@keyframes fadeInPop {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.suggestion-action-info {
  color: var(--text-muted, #6b7280);
  font-size: 12px;
  font-weight: 500;
  padding: 0 4px;
  white-space: nowrap;
}

.dark .suggestion-action-info {
  color: #9ca3af;
}

.suggestion-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.suggestion-action-btn.accept {
  background: #2563eb;
  color: #ffffff;
}
.suggestion-action-btn.accept:hover {
  background: #1d4ed8;
}

.suggestion-action-btn.reject {
  background: #f3f4f6;
  color: #374151;
}
.dark .suggestion-action-btn.reject {
  background: #374151;
  color: #e5e7eb;
}
.suggestion-action-btn.reject:hover {
  background: #e5e7eb;
}
.dark .suggestion-action-btn.reject:hover {
  background: #4b5563;
}

/* ==========================================
   Preview Mode / Reader View
   - Unaccepted insertions are completely HIDDEN from reader
   - Unaccepted deletions are rendered as NORMAL UNTOUCHED TEXT
   - Suggestion notes are completely HIDDEN from reader
   ========================================== */
.ProseMirror.preview-mode .suggestion-insert,
.preview-mode .suggestion-insert {
  display: none !important;
}

.ProseMirror.preview-mode .suggestion-delete,
.preview-mode .suggestion-delete {
  color: inherit !important;
  text-decoration: none !important;
  background: transparent !important;
  opacity: 1 !important;
  padding: 0 !important;
}

.ProseMirror.preview-mode .suggestion-note,
.preview-mode .suggestion-note,
.ProseMirror.preview-mode figure[data-sug-delete]::after,
.preview-mode figure[data-sug-delete]::after {
  display: none !important;
}

.ProseMirror.preview-mode figure[data-sug-delete],
.preview-mode figure[data-sug-delete] {
  outline: none !important;
  opacity: 1 !important;
}

.ProseMirror.is-over-limit {
  caret-color: #ec404eff;
}

@keyframes shake-editor {
  0% { transform: translateX(0); }
  25% { transform: translateX(-1px); }
  75% { transform: translateX(1px); }
  100% { transform: translateX(0); }
}

.shake-animation {
  animation: shake-editor 0.15s ease-in-out;
}

.ProseMirror ::selection {
  background: var(--editor-selection);
}

.ProseMirror p {
  margin: 0 0 0.5em 0;
}

/* Блочное изображение с подписью */
.image-block {
  margin: 1.2em 0;
  text-align: center;
  cursor: default;
}

/* Скрытие ровно одной пустой строки до и после изображения в Preview режиме */
.preview-mode p:has(br:only-child):has(+ .image-block),
.preview-mode p:empty:has(+ .image-block) {
  display: none;
}

.preview-mode .image-block + p:has(br:only-child),
.preview-mode .image-block + p:empty {
  display: none;
}

.image-block img {
  max-width: 100%;
  border-radius: 6px;
  display: block;
  margin: 0 auto;
}

.image-caption {
  margin-top: 8px;
  font-size: 0.85em;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.15s;
  line-height: 1.4;
}
.image-caption:hover {
  color: var(--text-primary);
}
.image-caption.placeholder {
  font-style: italic;
  color: var(--text-disabled, rgba(128,128,128,0.35));
}

.image-caption-input {
  display: block;
  margin: 8px auto 0;
  padding: 4px 10px;
  font-size: 0.85em;
  text-align: center;
  color: var(--text-primary);
  background: var(--bg-hover);
  border: 1px solid var(--accent);
  border-radius: 4px;
  outline: none;
  width: 70%;
  max-width: 400px;
  font-family: inherit;
}

/* Заголовки */
.ProseMirror h1 { font-size: 2em; font-weight: 700; color: var(--editor-heading); line-height: 1.3; margin: 1em 0 0.4em 0; }
.ProseMirror h2 { font-size: 1.5em; font-weight: 650; color: var(--editor-heading); line-height: 1.35; margin: 0.8em 0 0.3em 0; }
.ProseMirror h3 { font-size: 1.25em; font-weight: 600; color: var(--editor-heading-h3); line-height: 1.4; margin: 0.7em 0 0.3em 0; }
.ProseMirror h4 { font-size: 1.1em; font-weight: 600; color: var(--editor-heading-h4); line-height: 1.45; margin: 0.6em 0 0.3em 0; }
.ProseMirror h5 { font-size: 1.05em; font-weight: 600; color: var(--editor-heading-h5); line-height: 1.5; margin: 0.5em 0 0.2em 0; }
.ProseMirror h6 { font-size: 1em; font-weight: 600; color: var(--editor-heading-h6); line-height: 1.5; margin: 0.5em 0 0.2em 0; }

.pm-heading-prefix {
  color: var(--editor-prefix);
  font-weight: 400;
  font-size: 0.65em;
  line-height: inherit;
  vertical-align: baseline;
  user-select: none;
  pointer-events: none;
  margin-right: 2px;
  display: none;
}

/* Показываем префикс только когда курсор внутри заголовка */
.heading-cursor-inside .pm-heading-prefix {
  display: inline;
}

/* Сворачивание заголовков */
.editor-heading {
  position: relative;
}

.heading-fold-btn {
  position: absolute;
  left: -24px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  background: transparent;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
  padding: 0;
}

.editor-heading:hover .heading-fold-btn {
  opacity: 1;
}

.heading-fold-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.heading-fold-btn svg {
  transition: transform 0.2s;
}

.is-folded .heading-fold-btn {
  opacity: 1;
}

.is-folded .heading-fold-btn svg {
  transform: rotate(-90deg);
}

.folded-content {
  display: none !important;
}

/* Цитаты */
.ProseMirror blockquote {
  border-left: 4px solid var(--editor-blockquote-border);
  padding-left: 16px;
  margin: 16px 0;
  color: var(--editor-blockquote-text);
  background: var(--editor-blockquote-bg);
  padding-top: 8px;
  padding-bottom: 8px;
  border-radius: 0 4px 4px 0;
}
.ProseMirror blockquote p { margin-bottom: 0.5em; color: inherit; }
.ProseMirror blockquote p:last-child { margin-bottom: 0; }

/* Списки */
.ProseMirror ul, .ProseMirror ol { padding-left: 24px; margin: 8px 0; }
.ProseMirror ul { list-style-type: disc; }
.ProseMirror ol { list-style-type: decimal; }
.ProseMirror li { margin-bottom: 4px; line-height: 1.6; }

/* Task list */
.ProseMirror li.task-list-item {
  list-style: none;
  position: relative;
  margin-left: -1.5em;
  padding-left: 1.75em;
}
.ProseMirror li.task-list-item::before {
  content: '';
  position: absolute;
  left: 0.25em; top: 0.25em;
  width: 1em; height: 1em;
  border: 0.08em solid var(--accent);
  border-radius: 0.25em;
  background: transparent;
  display: inline-block;
  pointer-events: none;
}
.ProseMirror li.task-list-item[data-checked="true"]::before {
  background: var(--accent);
  border-color: var(--accent);
}
.ProseMirror li.task-list-item[data-checked="true"]::after {
  content: '';
  position: absolute;
  left: 0.5625em; top: 0.375em;
  width: 0.25em; height: 0.5em;
  border: solid white;
  border-width: 0 0.125em 0.125em 0;
  transform: rotate(45deg);
  pointer-events: none;
}
.ProseMirror li.task-list-item[data-checked="true"] > p {
  color: var(--editor-strike);
  text-decoration: line-through;
}

/* Блоки кода */
.code-block-wrapper {
  background: var(--codeblock-bg);
  border-radius: 8px;
  margin: 16px 0;
  overflow: hidden;
  border: 1px solid var(--codeblock-border);
  position: relative;
}
.code-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: var(--codeblock-header);
  user-select: none;
}
.code-block-lang {
  color: var(--codeblock-lang);
  font-size: 12px;
  font-weight: 500;
  text-transform: lowercase;
}
.code-block-copy {
  background: none;
  border: none;
  color: var(--codeblock-copy);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}
.code-block-copy:hover {
  color: var(--codeblock-copy-hover-text);
  background: var(--codeblock-copy-hover-bg);
}
.code-block-copy .copied-text {
  font-size: 11px;
  color: var(--codeblock-copied);
}
.ProseMirror .code-block-wrapper pre { margin: 0; padding: 16px; overflow-x: auto; }
.code-block-content {
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 14px;
  line-height: 1.5;
  color: var(--codeblock-text);
}
.ProseMirror pre { background: transparent; padding: 0; margin: 0; border: none; }
.ProseMirror pre code { color: inherit; padding: 0; background: none; border-radius: 0; font-family: inherit; font-size: inherit; }

/* Syntax Highlighting */
.ProseMirror .hljs-keyword, .ProseMirror .hljs-selector-tag, .ProseMirror .hljs-operator { color: var(--hljs-keyword); }
.ProseMirror .hljs-string, .ProseMirror .hljs-meta .hljs-string, .ProseMirror .hljs-doctag, .ProseMirror .hljs-regexp { color: var(--hljs-string); }
.ProseMirror .hljs-title, .ProseMirror .hljs-section, .ProseMirror .hljs-name, .ProseMirror .hljs-selector-id, .ProseMirror .hljs-selector-class { color: var(--hljs-title); }
.ProseMirror .hljs-number, .ProseMirror .hljs-built_in, .ProseMirror .hljs-literal, .ProseMirror .hljs-type, .ProseMirror .hljs-params, .ProseMirror .hljs-variable, .ProseMirror .hljs-template-variable, .ProseMirror .hljs-link { color: var(--hljs-number); }
.ProseMirror .hljs-comment, .ProseMirror .hljs-quote, .ProseMirror .hljs-meta { color: var(--hljs-comment); font-style: italic; }
.ProseMirror .hljs-attr, .ProseMirror .hljs-attribute { color: var(--hljs-attr); }
.ProseMirror .hljs-symbol, .ProseMirror .hljs-bullet, .ProseMirror .hljs-addition { color: var(--hljs-symbol); }
.ProseMirror .hljs-deletion { color: var(--hljs-deletion); }

/* Math */
.math-inline { position: relative; display: inline-block; cursor: text; }
.math-inline.is-inactive .math-inline-editor { display: none; }
.math-inline.is-active .math-inline-render { display: none; }
.math-inline.is-active { color: var(--math-text); font-family: inherit; font-size: 1em; }
.math-inline.is-active::before { content: "$"; color: var(--math-dollar); }
.math-inline.is-active::after { content: "$"; color: var(--math-dollar); }
.math-inline-render-anchor { position: relative; display: inline; }
.math-inline-render { font-size: 1em; color: var(--math-render); cursor: text; user-select: none; }
.math-inline-preview { display: inline-block; font-size: 1em; color: var(--math-render); user-select: none; }
.math-inline-tooltip-anchor { position: relative; display: inline; width: 0; height: 0; }
.math-inline-tooltip {
  position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
  background: var(--tooltip-bg); border: 1px solid var(--tooltip-border);
  padding: 4px 8px; border-radius: 6px;
  box-shadow: 0 4px 12px var(--tooltip-shadow);
  z-index: 100; pointer-events: none; font-size: 1.1em; white-space: nowrap; color: var(--math-render);
}

/* Block Math */
.math-block-wrapper { margin: 16px 0; border: 1px solid transparent; border-radius: 8px; }
.math-block-editor-wrapper {
  background: var(--math-block-editor-bg); border: 1px solid var(--math-block-editor-border);
  border-radius: 8px 8px 0 0; padding: 12px; display: none;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  color: var(--math-text); white-space: pre-wrap;
}
.math-block-preview-wrapper { background: transparent; padding: 12px; text-align: center; position: relative; }
.math-block-preview-header {
  display: none; justify-content: space-between; align-items: center;
  background: var(--math-block-header-bg); padding: 6px 12px;
  font-size: 12px; color: var(--codeblock-lang);
  border: 1px solid var(--math-block-editor-border);
  border-top: none; border-radius: 0 0 8px 8px; margin: -12px -12px 12px -12px;
}
.math-btn-ok { background: none; border: none; color: var(--math-btn-ok); cursor: pointer; padding: 2px 6px; border-radius: 4px; }
.math-btn-ok:hover { background: var(--math-btn-ok-hover); }
.math-block-wrapper.is-active .math-block-editor-wrapper { display: block; }
.math-block-wrapper.is-active .math-block-preview-header { display: flex; }
.math-block-wrapper.is-active .math-block-preview-wrapper {
  background: var(--math-block-active-bg);
  border: 1px dashed var(--math-block-active-border);
  border-top: none; border-radius: 0 0 8px 8px;
}

/* Tooltips */
.pm-tooltip {
  position: absolute; z-index: 1000;
  background: var(--tooltip-bg); border: 1px solid var(--tooltip-border);
  border-radius: 6px; padding: 6px;
  box-shadow: 0 4px 12px var(--tooltip-shadow);
}
.pm-tooltip-input {
  background: var(--tooltip-input-bg); border: 1px solid var(--tooltip-input-border);
  color: var(--codeblock-text); padding: 6px 12px; border-radius: 4px;
  font-size: 13px; outline: none; min-width: 250px; display: block;
}
.pm-tooltip-input:focus { border-color: var(--editor-link); }

/* Изображения и Ссылки */
.ProseMirror img {
  max-width: 100%;
  border-radius: 6px;
  margin: 12px auto;
  display: block;
  cursor: pointer;
  border: 1px solid transparent;
}
.ProseMirror img.ProseMirror-selectednode { border-color: var(--editor-link); }
.ProseMirror a { color: var(--editor-link); text-decoration: none; cursor: text; }
.ProseMirror a:hover { text-decoration: underline; }

/* Inline стили */
.ProseMirror strong { font-weight: 700; color: var(--editor-strong); }
.ProseMirror em { font-style: italic; color: var(--editor-em); }
.ProseMirror code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  background: var(--editor-code-bg); border-radius: 4px;
  padding: 1px 6px; font-size: 0.88em; color: var(--editor-code-text);
}
.ProseMirror s { text-decoration: line-through; color: var(--editor-strike); }
.ProseMirror mark { background: var(--editor-mark-bg); color: var(--editor-mark-text); border-radius: 3px; padding: 0 2px; }
/* Inline mark syntax — через ::before / ::after псевдоэлементы.
   Не создают отдельных DOM-нод, не переносятся на новую строку
   отдельно от текста, не взаимодействуют с trailing BR. */
.pm-mark-start::before {
  content: attr(data-mark-open);
  color: var(--editor-syntax);
  font-weight: 400;
  font-style: normal;
  text-decoration: none;
  font-family: 'Inter', sans-serif;
  font-size: 0.85em;
  line-height: 0;
  vertical-align: baseline;
  background: none;
  padding: 0;
  border-radius: 0;
}
.pm-mark-end::after {
  content: attr(data-mark-close);
  color: var(--editor-syntax);
  font-weight: 400;
  font-style: normal;
  text-decoration: none;
  font-family: 'Inter', sans-serif;
  font-size: 0.85em;
  line-height: 0;
  vertical-align: baseline;
  background: none;
  padding: 0;
  border-radius: 0;
}
/* Widget-стиль — только для пустых марок (storedMarks без текста) */
.pm-mark-syntax {
  color: var(--editor-syntax); font-weight: 400; font-style: normal;
  font-family: 'Inter', sans-serif; font-size: 0.85em; user-select: none; pointer-events: none;
  line-height: 0; vertical-align: baseline;
}
/* Скрыть trailing <br> после виджетов, бейджей примечаний и чужих курсоров — иначе появляется фантомная строка */
.pm-mark-syntax ~ br:last-child,
.suggestion-note ~ br:last-child,
.suggestion-note-badge ~ br:last-child,
.ProseMirror-yjs-cursor ~ br:last-child,
.ProseMirror-widget ~ br:last-child,
.ProseMirror-separator ~ br:last-child {
  display: none !important;
}

/* Горизонтальная линия */
.ProseMirror hr { border: none; border-top: 1px solid var(--editor-hr); margin: 16px 0; }

/* Таблицы */
.ProseMirror table {
  border-collapse: separate; border-spacing: 0; width: 100%; margin: 12px 0;
  border-radius: 8px; overflow: hidden; border: 1px solid var(--codeblock-border); table-layout: auto;
}
.ProseMirror th, .ProseMirror td {
  padding: 8px 16px; border-bottom: 1px solid var(--table-border);
  border-right: 1px solid var(--table-border); vertical-align: top; position: relative;
}
.ProseMirror th:last-child, .ProseMirror td:last-child { border-right: none; }
.ProseMirror tbody tr:last-child td { border-bottom: none; }
.ProseMirror th { background: var(--table-header-bg); font-weight: 600; color: var(--table-header-text); border-bottom: 2px solid var(--codeblock-border); }
.ProseMirror td { background: var(--table-cell-bg); color: var(--table-cell-text); }
.ProseMirror tbody tr:nth-child(even) td { background: var(--table-even-bg); }
.ProseMirror .selectedCell::after {
  z-index: 2; position: absolute; content: "";
  left: 0; right: 0; top: 0; bottom: 0;
  background: var(--table-selected); pointer-events: none;
}
.ProseMirror .column-resize-handle {
  position: absolute; right: -2px; top: 0; bottom: 0;
  width: 4px; z-index: 20; background-color: var(--accent);
  pointer-events: auto; cursor: col-resize;
}
.ProseMirror th p, .ProseMirror td p { margin: 0; }

/* Gap Cursor */
.ProseMirror .ProseMirror-gapcursor { position: relative; }
.ProseMirror .ProseMirror-gapcursor::after {
  content: ""; display: block; position: absolute;
  top: -2px; width: 20px; border-top: 2px solid var(--accent);
  animation: ProseMirror-cursor-blink 1.1s steps(2, start) infinite;
}
@keyframes ProseMirror-cursor-blink { to { visibility: hidden; } }

/* ==========================================
   Preview Mode — кликабельные ссылки
   ========================================== */
.ProseMirror.preview-mode a {
  cursor: pointer;
  pointer-events: auto;
}
.ProseMirror.preview-mode a:hover {
  text-decoration: underline;
}

/* ==========================================
   Спойлеры
   ========================================== */
.pm-spoiler {
  background: var(--bg-hover);
  border-radius: 4px;
  padding: 0 4px;
  transition: all 0.2s ease;
}

/* В Preview режиме спойлеры скрыты черным фоном (цвет текста прозрачный или совпадает с фоном) */
.ProseMirror.preview-mode .pm-spoiler {
  background: var(--bg-active);
  color: transparent;
  cursor: pointer;
  user-select: none;
}

.ProseMirror.preview-mode .pm-spoiler.is-revealed {
  background: var(--bg-hover);
  color: var(--text-primary);
  user-select: text;
}

/* Интерактивные чекбоксы курсор */
.ProseMirror:not(.preview-mode) li.task-list-item::before {
  cursor: pointer;
}

/* ==========================================
   Режимы акцентирования (Focus Mode)
   ========================================== */

/* Общее приглушение для режима "Абзац" и "Предложение" */
.focus-mode-paragraph .ProseMirror > *:not(.focus-active-paragraph),
.focus-mode-sentence .ProseMirror > *:not(.focus-active-paragraph) {
  opacity: 0.25;
}

/* Плавное появление ТОЛЬКО для активного элемента.
   Элементы, теряющие фокус, гаснут мгновенно — это убирает моргание
   при переключении между абзацами (из-за удаления inline focus-dimmed декораций). */
.focus-mode-paragraph .ProseMirror > .focus-active-paragraph,
.focus-mode-sentence .ProseMirror > .focus-active-paragraph {
  transition: opacity 0.3s ease-in-out;
}

/* Приглушение несвязанных предложений внутри активного абзаца */
.focus-mode-sentence .focus-dimmed {
  opacity: 0.25;
}

/* ==========================================
   Поиск по документу
   ========================================== */
.search-match {
  background: rgba(255, 215, 0, 0.3);
  border-radius: 2px;
}
.search-match-current {
  background: rgba(255, 165, 0, 0.6);
  border-radius: 2px;
  outline: 1px solid rgba(255, 165, 0, 0.8);
}

.search-bar {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  max-width: 560px;
  min-width: 280px;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}

.search-input {
  flex: 1;
  background: var(--bg-input);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 13px;
  color: var(--text-primary);
  outline: none;
  font-family: inherit;
  min-width: 0;
}
.search-input:focus {
  border-color: var(--accent);
}
.search-input::placeholder {
  color: var(--text-dim);
}

.search-count {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  min-width: 70px;
  text-align: center;
}

.search-nav-btn {
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.search-nav-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.search-nav-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

/* ── Table editing mode ── */
.te-col-drag { background: transparent; border-radius: 4px; transition: background 0.12s; }
.te-col-drag:hover { background: rgba(99,123,229,0.12); }
.te-col-drag.te-dragging { background: rgba(99,123,229,0.28); cursor: grabbing; }
.te-col-drag.te-drop-target { background: rgba(99,123,229,0.35); }

.te-row-drag { background: transparent; border-radius: 4px; transition: background 0.12s; }
.te-row-drag:hover { background: rgba(99,123,229,0.12); }
.te-row-drag.te-dragging { background: rgba(99,123,229,0.28); cursor: grabbing; }
.te-row-drag.te-drop-target { background: rgba(99,123,229,0.35); }

.te-col-del, .te-row-del {
  border: none; border-radius: 3px;
  background: rgba(255,255,255,0.06);
  color: var(--text-dim);
  font-size: 13px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.12s;
}
.te-col-del:hover, .te-row-del:hover {
  background: rgba(232,17,35,0.25);
  color: #e81123;
}

.te-col-add, .te-row-add {
  width: 18px; height: 18px;
  border: none; border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 13px; font-weight: bold;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  opacity: 0.65;
  transition: opacity 0.12s, transform 0.12s;
}
.te-col-add:hover, .te-row-add:hover {
  opacity: 1;
  transform: scale(1.15);
}

.te-done-btn {
  padding: 4px 20px;
  border: none; border-radius: 6px;
  background: var(--accent);
  color: #fff;
  font-size: 13px; font-weight: 600;
  cursor: pointer;
  transition: opacity 0.12s;
}
.te-done-btn:hover { opacity: 0.85; }

/* ==========================================
   Совместная работа — курсоры и выделения
   ========================================== */
.ProseMirror-yjs-cursor {
  position: relative;
  display: inline;
  line-height: 0;
  vertical-align: baseline;
  pointer-events: none;
}
.ProseMirror-yjs-cursor > div {
  position: absolute;
  top: -1.2em;
  left: -1px;
  font-size: 10px;
  font-weight: 500;
  font-family: Inter, system-ui, sans-serif;
  color: #fff;
  padding: 1px 5px;
  border-radius: 3px;
  white-space: nowrap;
  line-height: 1.3;
  pointer-events: none;
  user-select: none;
}
.ProseMirror-yjs-selection {
  pointer-events: none;
  opacity: 0.3;
}
`
}
