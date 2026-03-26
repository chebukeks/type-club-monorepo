/**
 * markdownConfig.ts — Markdown ↔ ProseMirror конвертация
 *
 * - parse(markdown: string) → ProseMirror Node (документ)
 * - serialize(doc: ProseMirrorNode) → markdown string
 *
 * Использует prosemirror-markdown (который внутри использует markdown-it).
 * Добавлена поддержка таблиц через markdown-it плагин.
 */
import { Node as PMNode } from 'prosemirror-model'
import {
  MarkdownParser,
  MarkdownSerializer,
} from 'prosemirror-markdown'
import MarkdownIt from 'markdown-it'
// @ts-expect-error: no types available for markdown-it-mark
import markPlugin from 'markdown-it-mark'
// @ts-expect-error: no types available for markdown-it-task-lists
import taskListsPlugin from 'markdown-it-task-lists'
import { schema } from './schema'

// ============================================================
// Парсер: Markdown → ProseMirror doc
// ============================================================

// Создаём markdown-it экземпляр с поддержкой таблиц, strikethrough, mark и task-lists
const md = new MarkdownIt('commonmark', { html: false })
  .enable('table')
  .enable('strikethrough')
  .use(markPlugin)
  .use(taskListsPlugin, { enabled: true, label: true })

/**
 * Парсер.
 * Маппинг markdown-it токенов → ProseMirror nodes/marks.
 */
export const markdownParser = new MarkdownParser(schema, md, {
  // Блочные ноды
  blockquote: { block: 'blockquote' },
  paragraph: { block: 'paragraph' },
  heading: {
    block: 'heading',
    getAttrs: (tok) => ({ level: Number(tok.tag.slice(1)) }),
  },
  hr: { node: 'horizontal_rule' },
  hard_break: { node: 'hard_break' },

  // Списки
  bullet_list: { block: 'bullet_list' },
  ordered_list: { block: 'ordered_list', getAttrs: tok => ({ order: Number(tok.attrGet('start')) || 1 }) },
  list_item: { block: 'list_item' },

  // Таблицы
  table: { block: 'table' },
  thead: { ignore: true }, // Контент обрабатывается через tr
  tbody: { ignore: true },
  tr: { block: 'table_row' },
  th: { block: 'table_header' },
  td: { block: 'table_cell' },

  // Inline marks
  em: { mark: 'em' },
  strong: { mark: 'strong' },
  code_inline: { mark: 'code', noCloseToken: true },
  s: { mark: 's' },
  mark: { mark: 'highlight' },

  // Игнорируемые токены (не в MVP)
  code_block: { block: 'code_block', noCloseToken: true },
  fence: { block: 'code_block', getAttrs: tok => ({ params: tok.info || '' }), noCloseToken: true },
  image: { ignore: true },
  link: { mark: 'em' },       // Ссылки — пока рендерим как курсив (пока нет mark link)
  softbreak: { node: 'hard_break' },
  html_inline: { ignore: true },
  html_block: { ignore: true },
})

// ============================================================
// Сериализатор: ProseMirror doc → Markdown
// ============================================================

export const markdownSerializer = new MarkdownSerializer(
  {
    // --- Ноды ---
    doc(state, node) {
      state.renderContent(node)
    },

    paragraph(state, node) {
      state.renderInline(node)
      state.closeBlock(node)
    },

    blockquote(state, node) {
      state.wrapBlock('> ', null, node, () => state.renderContent(node))
    },

    heading(state, node) {
      state.write('#'.repeat(node.attrs.level) + ' ')
      state.renderInline(node)
      state.closeBlock(node)
    },

    code_block(state, node) {
      state.write('```' + (node.attrs.params || '') + '\n')
      state.text(node.textContent, false)
      state.ensureNewLine()
      state.write('```')
      state.closeBlock(node)
    },

    horizontal_rule(state, node) {
      state.write('---')
      state.closeBlock(node)
    },

    bullet_list(state, node) {
      state.renderList(node, '  ', () => '* ')
    },

    ordered_list(state, node) {
      const start = node.attrs.order || 1
      const maxW = String(start + node.childCount - 1).length
      const space = state.repeat(' ', maxW + 2)
      state.renderList(node, space, i => {
        const nStr = String(start + i)
        return state.repeat(' ', maxW - nStr.length) + nStr + '. '
      })
    },

    list_item(state, node) {
      if (node.attrs.checked !== null) {
        state.write(node.attrs.checked ? '[x] ' : '[ ] ')
      }
      state.renderContent(node)
    },

    hard_break(state) {
      state.write('\\\n')
    },

    text(state, node) {
      state.text(node.text || '')
    },

    // --- Таблицы ---
    table(state, node) {
      // Собираем все строки
      const rows: PMNode[] = []
      node.forEach(row => rows.push(row))

      if (rows.length === 0) {
        state.closeBlock(node)
        return
      }

      // Вычисляем ширины столбцов
      const colCount = getColCount(rows[0])
      const colWidths: number[] = new Array(colCount).fill(3)

      // Проходим по всем ячейкам для определения ширин
      for (const row of rows) {
        let col = 0
        row.forEach(cell => {
          const text = cellText(state, cell)
          colWidths[col] = Math.max(colWidths[col], text.length)
          col++
        })
      }

      // Определяем, какая строка — заголовок
      const firstRow = rows[0]
      const isHeaderRow = firstRow.firstChild?.type.name === 'table_header'

      // Рендерим строки
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r]
        let col = 0
        state.write('|')
        row.forEach(cell => {
          const text = cellText(state, cell)
          state.write(` ${text.padEnd(colWidths[col])} |`)
          col++
        })
        state.write('\n')

        // После заголовка — разделитель
        if (r === 0 && isHeaderRow) {
          state.write('|')
          for (let c = 0; c < colCount; c++) {
            state.write('-'.repeat(colWidths[c] + 2) + '|')
          }
          state.write('\n')
        }
      }

      state.closeBlock(node)
    },

    table_row() { /* обрабатывается в table */ },
    table_cell() { /* обрабатывается в table */ },
    table_header() { /* обрабатывается в table */ },
  },
  {
    // --- Marks ---
    strong: {
      open: '**',
      close: '**',
      mixable: true,
      expelEnclosingWhitespace: true,
    },
    em: {
      open: '*',
      close: '*',
      mixable: true,
      expelEnclosingWhitespace: true,
    },
    code: {
      open(_state, _mark, _parent, _index) { return '`' },
      close(_state, _mark, _parent, _index) { return '`' },
      escape: false,
    },
    s: {
      open: '~~',
      close: '~~',
      mixable: true,
      expelEnclosingWhitespace: true,
    },
    highlight: {
      open: '==',
      close: '==',
      mixable: true,
      expelEnclosingWhitespace: true,
    },
  }
)

// ============================================================
// Хелперы
// ============================================================

/** Получить количество колонок в строке */
function getColCount(row: PMNode): number {
  let count = 0
  row.forEach(() => count++)
  return count
}

/** Получить текстовое содержимое ячейки (с марками) */
function cellText(_state: unknown, cell: PMNode): string {
  // Создаём временный сериализатор для рендера содержимого ячейки
  let result = ''
  cell.forEach(child => {
    if (child.isText) {
      let text = child.text || ''
      // Применяем марки
      if (child.marks.length > 0) {
        for (const mark of child.marks) {
          if (mark.type.name === 'strong') text = `**${text}**`
          else if (mark.type.name === 'em') text = `*${text}*`
          else if (mark.type.name === 'code') text = `\`${text}\``
        }
      }
      result += text
    } else if (child.type.name === 'paragraph') {
      child.forEach(inline => {
        if (inline.isText) {
          let text = inline.text || ''
          if (inline.marks.length > 0) {
            for (const mark of inline.marks) {
              if (mark.type.name === 'strong') text = `**${text}**`
              else if (mark.type.name === 'em') text = `*${text}*`
              else if (mark.type.name === 'code') text = `\`${text}\``
            }
          }
          result += text
        }
      })
    }
  })
  return result
}

// ============================================================
// Публичные функции
// ============================================================

/** Markdown string → ProseMirror document */
export function parseMarkdown(markdown: string): PMNode {
  const doc = markdownParser.parse(markdown)
  if (!doc) {
    // Если парсинг вернул null — пустой документ
    return schema.node('doc', null, [schema.node('paragraph')])
  }
  return doc
}

/** ProseMirror document → Markdown string */
export function serializeMarkdown(doc: PMNode): string {
  return markdownSerializer.serialize(doc)
}
