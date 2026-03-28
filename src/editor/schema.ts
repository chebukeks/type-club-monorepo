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
import { bulletList, orderedList, listItem } from 'prosemirror-schema-list'
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
    blockquote: {
      content: 'block+',
      group: 'block',
      parseDOM: [{ tag: 'blockquote' }],
      toDOM() { return ['blockquote', 0] },
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

    code_block: {
      content: 'text*',
      marks: '',
      group: 'block',
      code: true,
      defining: true,
      attrs: { params: { default: '' } },
      parseDOM: [
        {
          tag: 'pre',
          preserveWhitespace: 'full',
          getAttrs: (node: HTMLElement) => ({
            params: node.getAttribute('data-params') || '',
          }),
        },
      ],
      toDOM(node) {
        return ['pre', node.attrs.params ? { 'data-params': node.attrs.params } : {}, ['code', 0]]
      },
    },

    horizontal_rule: {
      group: 'block',
      parseDOM: [{ tag: 'hr' }],
      toDOM() { return ['hr'] },
    },

    // Подключаем таблицы
    ...tableNodeSpecs,

    bullet_list: {
      ...bulletList,
      content: 'list_item+',
      group: 'block',
    },

    ordered_list: {
      ...orderedList,
      content: 'list_item+',
      group: 'block',
    },

    list_item: {
      ...listItem,
      content: 'paragraph block*',
      attrs: {
        checked: { default: null }, // Для task-lists
      },
      parseDOM: [
        {
          tag: 'li',
          getAttrs(dom) {
            const hasCheckbox = (dom as HTMLElement).hasAttribute('data-checked')
            if (!hasCheckbox) return { checked: null }
            return { checked: (dom as HTMLElement).getAttribute('data-checked') === 'true' }
          },
        },
      ],
      toDOM(node) {
        if (node.attrs.checked !== null) {
          return [
            'li',
            {
              class: 'task-list-item',
              'data-checked': node.attrs.checked ? 'true' : 'false',
            },
            0,
          ]
        }
        return ['li', {}, 0]
      },
    },
    image: {
      inline: true,
      attrs: {
        src: {},
        alt: { default: null },
        title: { default: null }
      },
      group: 'inline',
      draggable: true,
      parseDOM: [{
        tag: 'img[src]',
        getAttrs(dom) {
          return {
            src: (dom as HTMLElement).getAttribute('src'),
            title: (dom as HTMLElement).getAttribute('title'),
            alt: (dom as HTMLElement).getAttribute('alt')
          }
        }
      }],
      toDOM(node) {
        return ['img', { ...node.attrs }]
      }
    },

    math_inline: {
      inline: true,
      atom: true,
      group: 'inline',
      attrs: {
        formula: { default: '' }
      },
      parseDOM: [{ 
        tag: 'span.math-inline',
        getAttrs: (dom) => ({ formula: (dom as HTMLElement).textContent || '' })
      }],
      toDOM: (node) => ['span', { class: 'math-inline' }, node.attrs.formula]
    },
    math_block: {
      content: 'text*',
      group: 'block',
      code: true,
      defining: true,
      parseDOM: [{ tag: 'div.math-block' }],
      toDOM() { return ['div', { class: 'math-block' }, 0] }
    },

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
    link: {
      attrs: {
        href: {},
        title: { default: null }
      },
      inclusive: false,
      parseDOM: [{
        tag: 'a[href]',
        getAttrs(dom) {
          return {
            href: (dom as HTMLElement).getAttribute('href'),
            title: (dom as HTMLElement).getAttribute('title')
          }
        }
      }],
      toDOM(node) { 
        return ['a', { ...node.attrs }, 0] 
      }
    },
    strong: {
      parseDOM: [{ tag: 'b' }, { tag: 'strong' }, { style: 'font-weight', getAttrs: value => /^(bold(er)?|[5-9]\d{2,})$/.test(value as string) && null }],
      toDOM() { return ['strong', 0] },
    },
    em: {
      parseDOM: [{ tag: 'i' }, { tag: 'em' }, { style: 'font-style=italic' }],
      toDOM() { return ['em', 0] },
    },
    code: {
      parseDOM: [{ tag: 'code' }],
      toDOM() { return ['code', 0] },
    },
    s: {
      parseDOM: [{ tag: 's' }, { tag: 'del' }, { tag: 'strike' }, { style: 'text-decoration=line-through' }],
      toDOM() { return ['s', 0] },
    },
    highlight: {
      parseDOM: [{ tag: 'mark' }],
      toDOM() { return ['mark', 0] },
    },
  },
})
