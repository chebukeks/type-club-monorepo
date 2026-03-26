/**
 * schema.ts — ProseMirror Schema для Type Club
 *
 * Определяет модель документа: какие ноды (блоки) и марки (инлайн-стили)
 * доступны в редакторе.
 *
 * MVP: doc, paragraph, heading, horizontal_rule, table*, text,
 *      strong, em, code
 */
import { Schema } from 'prosemirror-model'
import { tableNodes } from 'prosemirror-tables'

// ============================================================
// Таблицы из prosemirror-tables
// ============================================================
const tableNodeSpecs = tableNodes({
  tableGroup: 'block',
  cellContent: 'block+',
  cellAttributes: {
    alignment: {
      default: null,
      getFromDOM(dom: HTMLElement) {
        return dom.style.textAlign || null
      },
      setDOMAttr(value, attrs) {
        if (value) (attrs as Record<string, string>).style = ((attrs as Record<string, string>).style || '') + `text-align: ${value};`
      },
    },
  },
})

// ============================================================
// Схема
// ============================================================
export const schema = new Schema({
  nodes: {
    doc: {
      content: 'block+',
    },

    paragraph: {
      group: 'block',
      content: 'inline*',
      parseDOM: [{ tag: 'p' }],
      toDOM() { return ['p', 0] },
    },

    heading: {
      attrs: { level: { default: 1, validate: 'number' } },
      content: 'inline*',
      group: 'block',
      defining: true,
      parseDOM: [
        { tag: 'h1', attrs: { level: 1 } },
        { tag: 'h2', attrs: { level: 2 } },
        { tag: 'h3', attrs: { level: 3 } },
        { tag: 'h4', attrs: { level: 4 } },
        { tag: 'h5', attrs: { level: 5 } },
        { tag: 'h6', attrs: { level: 6 } },
      ],
      toDOM(node) { return [`h${node.attrs.level}`, 0] },
    },

    horizontal_rule: {
      group: 'block',
      parseDOM: [{ tag: 'hr' }],
      toDOM() { return ['hr'] },
    },

    // Подключаем таблицы
    ...tableNodeSpecs,

    text: {
      group: 'inline',
    },

    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM() { return ['br'] },
    },
  },

  marks: {
    strong: {
      parseDOM: [
        { tag: 'strong' },
        { tag: 'b', getAttrs: (node: HTMLElement) => node.style.fontWeight !== 'normal' && null },
        { style: 'font-weight=bold' },
        { style: 'font-weight', getAttrs: (value: string) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null },
      ],
      toDOM() { return ['strong', 0] },
    },

    em: {
      parseDOM: [
        { tag: 'i' },
        { tag: 'em' },
        { style: 'font-style=italic' },
      ],
      toDOM() { return ['em', 0] },
    },

    code: {
      parseDOM: [{ tag: 'code' }],
      toDOM() { return ['code', 0] },
    },
  },
})
