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
// @ts-ignore
import texmath from 'markdown-it-texmath'
import katex from 'katex'
import { schema } from './schema'

// Самописный плагин для task-lists (избегаем багов markdown-it-task-lists)
function taskListPlugin(md: MarkdownIt) {
  md.core.ruler.after('inline', 'task_lists', (state: any) => {
    const tokens = state.tokens
    for (let i = 2; i < tokens.length; i++) {
      if (tokens[i].type === 'inline') {
        const content = tokens[i].content
        if (content.startsWith('[ ] ') || content.toLowerCase().startsWith('[x] ')) {
          // Ищем предыдущий list_item_open
          for (let j = i - 1; j >= 0; j--) {
            if (tokens[j].type === 'list_item_open') {
              tokens[j].attrSet('checked', content.toLowerCase().startsWith('[x] ') ? 'true' : 'false')
              // Удаляем синтаксис чекбокса из текста
              tokens[i].content = content.slice(4)
              if (tokens[i].children && tokens[i].children[0].type === 'text') {
                tokens[i].children[0].content = tokens[i].children[0].content.slice(4)
              }
              break
            }
          }
        }
      }
    }
  })
}

// ============================================================
// Парсер: Markdown → ProseMirror doc
// ============================================================

// Создаём markdown-it экземпляр с поддержкой таблиц, strikethrough, mark и нашего taskListPlugin
const md = new MarkdownIt('default', { html: false })
  .enable('table')
  .enable('strikethrough')
  .use(markPlugin)
  .use(taskListPlugin)
  .use(texmath, { engine: katex, delimiters: 'dollars' })

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
  list_item: { 
    block: 'list_item',
    getAttrs: (tok) => {
      const checked = tok.attrGet('checked')
      return { checked: checked === 'true' ? true : checked === 'false' ? false : null }
    }
  },

  // Таблицы
  table: { block: 'table' },
  thead: { ignore: true }, // Контент обрабатывается через tr
  tbody: { ignore: true },
  tr: { block: 'table_row' },

  // Inline marks
  em: { mark: 'em' },
  strong: { mark: 'strong' },
  code_inline: { mark: 'code', noCloseToken: true },
  s: { mark: 's' },
  mark: { mark: 'highlight' },

  // Игнорируемые токены (не в MVP)
  code_block: { block: 'code_block', noCloseToken: true },
  fence: { block: 'code_block', getAttrs: tok => ({ params: tok.info || '' }), noCloseToken: true },
  math_inline: { block: 'math_inline' },
  math_block: { block: 'math_block', noCloseToken: true },
  math_display: { block: 'math_block', noCloseToken: true },
  image: { 
    node: 'image', 
    getAttrs: tok => ({ 
      src: tok.attrGet('src'), 
      alt: tok.children?.[0]?.content || tok.attrGet('alt') || null, 
      title: tok.attrGet('title') || null 
    }) 
  },
  link: { 
    mark: 'link', 
    getAttrs: tok => ({ 
      href: tok.attrGet('href'), 
      title: tok.attrGet('title') || null 
    }) 
  },
  softbreak: { node: 'hard_break' },
  hardbreak: { node: 'hard_break' },
  html_inline: { ignore: true },
  html_block: { ignore: true },
})

// Кастомные обработчики для ячеек таблицы
// В markdown-it внутри td/th лежат inline-токены, но prosemirror-tables требует блок (paragraph)
// Поэтому мы вручную открываем paragraph при открытии ячейки и закрываем при закрытии.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handlers = (markdownParser as any).tokenHandlers || (markdownParser as any).handlers

if (handlers) {
  handlers.th_open = (state: any) => {
    state.openNode(schema.nodes.table_header)
    state.openNode(schema.nodes.paragraph)
  }
  handlers.th_close = (state: any) => {
    state.closeNode() // close paragraph
    state.closeNode() // close table_header
  }
  handlers.td_open = (state: any) => {
    state.openNode(schema.nodes.table_cell)
    state.openNode(schema.nodes.paragraph)
  }
  handlers.td_close = (state: any) => {
    state.closeNode() // close paragraph
    state.closeNode() // close table_cell
  }
}

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
      state.renderList(node, '  ', () => '- ')
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

      // Проходим по всем ячейкам для определения ширин
      const colWidths: number[] = []
      for (const row of rows) {
        let col = 0
        row.forEach(cell => {
          const text = cellText(state, cell)
          const currentMax = colWidths[col] || 3
          colWidths[col] = Math.max(currentMax, text.length)
          col++
        })
      }

      // Максимальное количество колонок по всем строкам
      const maxCols = colWidths.length

      // Функция вывода строки
      const renderRow = (row: PMNode, isHeader = false) => {
        let col = 0
        let rowStr = '|'
        row.forEach(cell => {
          const text = cellText(state, cell)
          const width = colWidths[col] || 3
          rowStr += ` ${text.padEnd(width, ' ')} |`
          col++
        })
        // Добиваем пустые ячейки, если строка короче самой длинной
        while (col < maxCols) {
          const width = colWidths[col] || 3
          rowStr += ` ${' '.padEnd(width, ' ')} |`
          col++
        }
        state.write(rowStr + '\n')

        if (isHeader) {
          let sepStr = '|'
          for (let i = 0; i < maxCols; i++) {
            const width = colWidths[i] || 3
            sepStr += `-${'-'.repeat(width)}-|`
          }
          state.write(sepStr + '\n')
        }
      }

      // Рендерим заголовки и тело
      renderRow(rows[0], true)
      for (let i = 1; i < rows.length; i++) {
        renderRow(rows[i], false)
      }

      state.closeBlock(node)
    },
    table_cell() { /* обрабатывается в table */ },
    table_header() { /* обрабатывается в table */ },
    math_inline(state, node) {
      state.write('$' + node.textContent + '$')
    },
    math_block(state, node) {
      state.write('$$\n' + node.textContent + '\n$$')
      state.closeBlock(node)
    },
    image(state, node) {
      const alt = node.attrs.alt || ''
      const src = node.attrs.src || ''
      const title = node.attrs.title ? ` "${node.attrs.title.replace(/"/g, '\\"')}"` : ''
      state.write(`![${alt}](${src}${title})`)
    },
  },
  {
    // --- Marks ---
    link: {
      open: '[',
      close(_state, mark) {
        const href = mark.attrs.href || ''
        const title = mark.attrs.title ? ` "${mark.attrs.title.replace(/"/g, '\\"')}"` : ''
        return `](${href}${title})`
      },
      escape: false
    },
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
