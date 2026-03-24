/**
 * editorTheme.ts — Кастомная тема CodeMirror 6
 * Определяет визуальные стили редактора, интегрированные с общим дизайном приложения.
 */
import { EditorView } from '@codemirror/view'

/** Основная тема редактора */
export const editorTheme = EditorView.theme({
  // Корневой контейнер редактора
  '&': {
    height: '100%',
    fontSize: '15px',
    backgroundColor: '#1a1b1e',
    color: '#e1e1e3',
  },

  // Область с содержимым (текстом)
  '.cm-content': {
    fontFamily: "'Inter', 'SF Pro Text', -apple-system, sans-serif",
    lineHeight: '1.75',
    padding: '24px 48px',
    caretColor: '#6c8cff',
    maxWidth: '800px',
    margin: '0 auto',
  },

  // Курсор
  '&.cm-focused .cm-cursor': {
    borderLeftColor: '#6c8cff',
    borderLeftWidth: '2px',
  },

  // Активная строка
  '.cm-activeLine': {
    backgroundColor: 'rgba(108, 140, 255, 0.05)',
  },

  // Выделение текста
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(108, 140, 255, 0.2) !important',
  },

  // Убираем стандартный outline при фокусе
  '&.cm-focused': {
    outline: 'none',
  },

  // --- Стили для seamless Markdown ---

  // Заголовок H1
  '.cm-md-header1': {
    fontSize: '2em',
    fontWeight: '700',
    color: '#e8eaed',
    lineHeight: '1.3',
  },

  // Заголовок H2
  '.cm-md-header2': {
    fontSize: '1.5em',
    fontWeight: '600',
    color: '#e8eaed',
    lineHeight: '1.4',
  },

  // Заголовок H3
  '.cm-md-header3': {
    fontSize: '1.25em',
    fontWeight: '600',
    color: '#d2d4d7',
    lineHeight: '1.4',
  },

  // Жирный текст
  '.cm-md-bold': {
    fontWeight: '700',
    color: '#f0f0f2',
  },

  // Курсив
  '.cm-md-italic': {
    fontStyle: 'italic',
    color: '#c8cad0',
  },

  // Инлайн-код
  '.cm-md-inlineCode': {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    backgroundColor: 'rgba(108, 140, 255, 0.1)',
    borderRadius: '3px',
    padding: '1px 5px',
    fontSize: '0.9em',
    color: '#8ca8ff',
  },

  // Цитата (blockquote)
  '.cm-md-blockquote': {
    borderLeft: '3px solid #6c8cff',
    paddingLeft: '16px',
    color: '#9ca0a8',
    fontStyle: 'italic',
  },

  // Список (маркер)
  '.cm-md-listMarker': {
    color: '#6c8cff',
    fontWeight: '700',
  },

  // Ссылка
  '.cm-md-link': {
    color: '#6c8cff',
    textDecoration: 'underline',
    textDecorationColor: 'rgba(108, 140, 255, 0.3)',
  },

  // Горизонтальная линия
  '.cm-md-hr': {
    color: '#3a3d44',
  },

  // Скрытые Markdown-символы (когда курсор не на строке)
  '.cm-md-hidden': {
    fontSize: '0',
    width: '0',
    display: 'inline',
    visibility: 'hidden',
    position: 'absolute' as any,
  },
}, { dark: true })
