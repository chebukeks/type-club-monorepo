/**
 * editorTheme.ts — Кастомная тема CodeMirror 6
 * Стили для всех Markdown-конструкций.
 */
import { EditorView } from '@codemirror/view'

export const editorTheme = EditorView.theme({
  // ==========================================
  // Базовые стили
  // ==========================================
  '&': {
    height: '100%',
    fontSize: '15px',
    backgroundColor: '#1a1b1e',
    color: '#e1e1e3',
  },
  '.cm-content': {
    fontFamily: "'Inter', 'SF Pro Text', -apple-system, sans-serif",
    lineHeight: '1.75',
    padding: '24px 48px',
    caretColor: '#6c8cff',
    maxWidth: '860px',
    margin: '0 auto',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: '#6c8cff',
    borderLeftWidth: '2px',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(108, 140, 255, 0.05)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(108, 140, 255, 0.2) !important',
  },
  '&.cm-focused': {
    outline: 'none',
  },

  // ==========================================
  // Заголовки
  // ==========================================
  '.cm-md-header1': { fontSize: '2em', fontWeight: '700', color: '#e8eaed', lineHeight: '1.3' },
  '.cm-md-header2': { fontSize: '1.5em', fontWeight: '650', color: '#e8eaed', lineHeight: '1.35' },
  '.cm-md-header3': { fontSize: '1.25em', fontWeight: '600', color: '#d2d4d7', lineHeight: '1.4' },
  '.cm-md-header4': { fontSize: '1.1em', fontWeight: '600', color: '#c0c3c8', lineHeight: '1.45' },
  '.cm-md-header5': { fontSize: '1.05em', fontWeight: '600', color: '#b0b3b8', lineHeight: '1.5' },
  '.cm-md-header6': { fontSize: '1em', fontWeight: '600', color: '#9ca0a8', lineHeight: '1.5' },

  // ==========================================
  // Инлайн-стили
  // ==========================================
  '.cm-md-bold': { fontWeight: '700', color: '#f0f0f2' },
  '.cm-md-italic': { fontStyle: 'italic', color: '#c8cad0' },
  '.cm-md-boldItalic': { fontWeight: '700', fontStyle: 'italic', color: '#f0f0f2' },
  '.cm-md-strikethrough': {
    textDecoration: 'line-through',
    textDecorationColor: '#6a6e78',
    color: '#6a6e78',
  },
  '.cm-md-highlight': {
    backgroundColor: 'rgba(255, 214, 0, 0.2)',
    color: '#ffd600',
    borderRadius: '2px',
    padding: '0 2px',
  },
  '.cm-md-inlineCode': {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    backgroundColor: 'rgba(108, 140, 255, 0.1)',
    borderRadius: '4px',
    padding: '1px 6px',
    fontSize: '0.88em',
    color: '#8ca8ff',
  },
  '.cm-md-link': {
    color: '#6c8cff',
    textDecoration: 'underline',
    textDecorationColor: 'rgba(108, 140, 255, 0.4)',
    textUnderlineOffset: '2px',
  },

  // ==========================================
  // Блоки кода
  // ==========================================
  '.cm-md-codeBlockLine': { backgroundColor: '#131416 !important' },
  '.cm-md-codeContent': {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: '0.88em',
    color: '#c8ccd4',
  },
  '.cm-md-codeFence': {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: '0.85em',
    color: '#4a4d54',
  },
  '.cm-md-codeLang': {
    fontFamily: "'Inter', sans-serif",
    fontSize: '0.75em',
    fontWeight: '600',
    color: '#6c8cff',
    textTransform: 'uppercase' as any,
    letterSpacing: '0.05em',
  },

  // ==========================================
  // Цитаты
  // ==========================================
  '.cm-md-blockquote': { color: '#9ca0a8', fontStyle: 'italic' },
  '.cm-md-blockquoteLine': {
    borderLeft: '3px solid #6c8cff',
    paddingLeft: '16px !important',
  },

  // ==========================================
  // Списки и чекбоксы
  // ==========================================
  '.cm-md-listMarker': { color: '#6c8cff', fontWeight: '700' },
  '.cm-md-checkboxTodo': { color: '#e1e1e3' },
  '.cm-md-checkboxDone': {
    color: '#6a6e78',
    textDecoration: 'line-through',
    textDecorationColor: '#4a4d54',
  },
  '.cm-md-checkbox': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    border: '2px solid #4a4d54',
    borderRadius: '3px',
    marginRight: '8px',
    fontSize: '11px',
    fontWeight: '700',
    verticalAlign: 'middle',
    lineHeight: '1',
  },
  '.cm-md-checkbox-checked': {
    backgroundColor: '#6c8cff',
    borderColor: '#6c8cff',
    color: '#fff',
  },

  // ==========================================
  // Таблицы — построчная стилизация
  // ==========================================

  // Строка заголовка
  '.cm-md-tableHeaderLine': {
    backgroundColor: '#1e2025 !important',
    borderTop: '1px solid #2d2e32',
    borderLeft: '1px solid #2d2e32',
    borderRight: '1px solid #2d2e32',
    borderTopLeftRadius: '6px',
    borderTopRightRadius: '6px',
    paddingLeft: '4px !important',
    paddingRight: '4px !important',
  },
  // Текст заголовка
  '.cm-md-thText': {
    fontWeight: '600',
    color: '#e8eaed',
    fontSize: '14px',
  },

  // Строка-разделитель (|---|---|)
  '.cm-md-tableSepLine': {
    backgroundColor: '#1e2025 !important',
    borderLeft: '1px solid #2d2e32',
    borderRight: '1px solid #2d2e32',
    lineHeight: '0.5 !important',
    maxHeight: '4px',
    overflow: 'hidden' as any,
    borderBottom: '2px solid #2d2e32',
  },
  '.cm-md-tableSep': {
    color: '#2d2e32',
    fontSize: '1px',
  },

  // Строки данных
  '.cm-md-tableRowLine': {
    backgroundColor: 'rgba(30, 32, 37, 0.5) !important',
    borderLeft: '1px solid #2d2e32',
    borderRight: '1px solid #2d2e32',
    borderBottom: '1px solid #232428',
    paddingLeft: '4px !important',
    paddingRight: '4px !important',
  },
  // Последняя строка — скругление снизу
  '.cm-md-tableRowLine:last-of-type, .cm-md-tableRowLine + .cm-line:not(.cm-md-tableRowLine)': {
    borderBottomLeftRadius: '6px',
    borderBottomRightRadius: '6px',
  },
  '.cm-md-tdText': {
    color: '#c8cad0',
    fontSize: '14px',
  },

  // Пайп-символы (|) — делаем тонкими разделителями
  '.cm-md-tablePipe': {
    color: '#3a3d44',
    fontWeight: '300',
  },

  // ==========================================
  // Горизонтальная линия
  // ==========================================
  '.cm-md-hr': { color: '#3a3d44' },
  '.cm-md-hr-widget': {
    border: 'none',
    borderTop: '1px solid #3a3d44',
    margin: '8px 0',
    display: 'block',
  },
}, { dark: true })
