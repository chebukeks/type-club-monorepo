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
// @ts-ignore
import taskListsPlugin from 'markdown-it-task-lists'

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

// Фикс для texmath: превращаем одинарный токен math_inline в тройку (open, text, close)
// чтобы ProseMirror мог распарсить content: 'text*'
function texmathFixPlugin(md: MarkdownIt) {
  md.core.ruler.after('inline', 'texmath_fix', (state: any) => {
    const tokens = state.tokens
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type === 'inline' && tokens[i].children) {
        const children = tokens[i].children
        for (let j = children.length - 1; j >= 0; j--) {
          if (children[j].type === 'math_inline') {
            const content = children[j].content
            
            // Используем обычные объекты, совместимые с prosemirror-markdown,
            const base = { level: 0, map: null, children: null, markup: '', info: '', meta: null, block: false, hidden: false }
            const open = { ...base, type: 'math_inline_open', tag: 'math', nesting: 1, attrs: null, content: '' } as any
            const text = { ...base, type: 'text', content: content, nesting: 0, attrs: null } as any
            const close = { ...base, type: 'math_inline_close', tag: 'math', nesting: -1, attrs: null, content: '' } as any
            
            children.splice(j, 1, open, text, close)
          }
        }
      }
    }
  })
}

// Переопределяем правило text, чтобы оно останавливалось на символе '|' (0x7c)
function patchedTextRule(state: any, silent: boolean) {
  let pos = state.pos
  while (pos < state.posMax) {
    const ch = state.src.charCodeAt(pos)
    if (ch === 0x7c /* | */) break
    switch (ch) {
      case 0x0a: case 0x21: case 0x23: case 0x24: case 0x25: case 0x26: case 0x2a: case 0x2b: 
      case 0x2d: case 0x3a: case 0x3c: case 0x3d: case 0x3e: case 0x40: case 0x5b: case 0x5c: 
      case 0x5d: case 0x5e: case 0x5f: case 0x60: case 0x7b: case 0x7d: case 0x7e:
        break
      default:
        pos++
        continue
    }
    break
  }
  if (pos === state.pos) return false
  if (!silent) state.pending += state.src.slice(state.pos, pos)
  state.pos = pos
  return true
}

// Кастомный плагин для парсинга спойлеров ||text||
function spoilerInlinePlugin(md: MarkdownIt) {
  // Меняем стандартное правило text, чтобы парсер проверял наши спойлеры
  md.inline.ruler.at('text', patchedTextRule)

  md.inline.ruler.before('emphasis', 'spoiler', (state: any, silent: boolean) => {
    const max = state.posMax
    const start = state.pos
    const marker = state.src.charCodeAt(start)

    // Ищем ||
    if (marker !== 0x7c /* | */) return false
    if (start + 1 >= max || state.src.charCodeAt(start + 1) !== 0x7c) return false

    let end = start + 2
    // Ищем закрывающие ||
    while (end < max - 1) {
      if (state.src.charCodeAt(end) === 0x7c && state.src.charCodeAt(end + 1) === 0x7c) {
        break
      }
      end++
    }

    if (end >= max - 1) return false // не нашли закрывающие, это не спойлер
    if (silent) return false // если silent мод, нам достаточно просто вернуть true (ниже) и не добавлять токены

    const tokenOpen = state.push('spoiler_open', 'span', 1)
    tokenOpen.markup = '||'
    tokenOpen.attrs = [['class', 'pm-spoiler']]
    
    // Рекурсивно парсим внутренний контент, чтобы поддерживать вложенные марки
    state.md.inline.parse(
      state.src.slice(start + 2, end),
      state.md,
      state.env,
      state.tokens
    )

    const tokenClose = state.push('spoiler_close', 'span', -1)
    tokenClose.markup = '||'

    state.pos = end + 2
    return true
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
  .use(texmathFixPlugin)
  .use(spoilerInlinePlugin)

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
  spoiler: { mark: 'spoiler' },

  // Игнорируемые токены (не в MVP)
  code_block: { block: 'code_block', noCloseToken: true },
  fence: { block: 'code_block', getAttrs: tok => ({ params: tok.info || '' }), noCloseToken: true },
  
  // КРИТИЧЕСКИЙ ФИКС: Используем `block` вместо `node`, чтобы MarkdownParser
  // зарегистрировал обработчики _open и _close для инлайн-ноды, позволив ей содержать текст!
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
    spoiler: {
      open: '||',
      close: '||',
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
  try {
    const doc = markdownParser.parse(markdown)
    if (!doc) {
      // Если парсинг вернул null — пустой документ
      return schema.node('doc', null, [schema.node('paragraph')])
    }
    return doc
  } catch (error: any) {
    console.error('Markdown parse error:', error)
    // Возвращаем документ с текстом ошибки, чтобы приложение не падало в "черный экран"
    return schema.node('doc', null, [
      schema.node('paragraph', null, [
         schema.text('CRITICAL PARSE ERROR: ' + (error.message || String(error)))
      ]),
      schema.node('code_block', { params: '' }, [
         schema.text(String(error.stack || ''))
      ])
    ])
  }
}

/** ProseMirror document → Markdown string */
export function serializeMarkdown(doc: PMNode): string {
  try {
    return markdownSerializer.serialize(doc)
  } catch (err) {
    console.error('Ошибка сериализации Markdown:', err)
    return ''
  }
}

/** Markdown string → HTML string (for Export) */
export function generateExportHtml(markdown: string): string {
  // --- Инициализируем чистый парсер специально для экспорта ---
  // Нам не нужны костыли для ProseMirror (texmathFixPlugin, кастомные чекбоксы),
  // нам нужен родной, стандартный рендер HTML.
  
  const exportMd = new MarkdownIt('default', {
    html: true,
    breaks: true,
    linkify: true,
  })
    .use(texmath, { engine: katex, delimiters: 'dollars' })
    .use(taskListsPlugin, { enabled: true, label: true })
    .use(markPlugin)
    .use(spoilerInlinePlugin)

  // Конвертируем Markdown в HTML тело
  const bodyHtml = exportMd.render(markdown)
  
  // Добавляем стили KaTeX через CDN, НО и локальный фолбэк для отключения 
  // дублирующихся .katex-mathml элементов, если CDN не подгрузится (например при экспорте PDF через Electron).
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Export</title>
  
  <!-- Подключение CSS для математики -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  
  <style>
    /* Дефолтная светлая тема (чистая/печатная) */
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #fff;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.25;
    }
    
    h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    
    p { margin-top: 0; margin-bottom: 16px; }
    
    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    
    code {
      font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 85%;
      background-color: rgba(27,31,35,0.05);
      border-radius: 3px;
      padding: 0.2em 0.4em;
    }
    
    pre {
      background-color: #f6f8fa;
      border-radius: 6px;
      padding: 16px;
      overflow: auto;
    }
    
    pre code {
      background-color: transparent;
      padding: 0;
    }
    
    blockquote {
      padding: 0 1em;
      color: #6a737d;
      border-left: 0.25em solid #dfe2e5;
      margin: 0 0 16px 0;
    }
    
    table {
      border-spacing: 0;
      border-collapse: collapse;
      margin-bottom: 16px;
      width: 100%;
    }
    
    table th, table td {
      padding: 6px 13px;
      border: 1px solid #dfe2e5;
    }
    
    table tr:nth-child(2n) {
      background-color: #f6f8fa;
    }
    
    hr {
      height: 0.25em;
      padding: 0;
      margin: 24px 0;
      background-color: #e1e4e8;
      border: 0;
    }
    
    /* Стили для математических блоков, чтобы они не дублировались даже если CDN падает (ошибка -100) */
    .katex-mathml {
      position: absolute;
      clip: rect(1px, 1px, 1px, 1px);
      padding: 0;
      border: 0;
      height: 1px;
      width: 1px;
      overflow: hidden;
    }
    
    .katex-display {
      overflow-x: auto;
      overflow-y: hidden;
      padding: 1rem 0;
    }

    /* Стили для нормального отображения чекбоксов (Task Lists) */
    .task-list-item {
      list-style-type: none;
    }
    .task-list-item input[type="checkbox"] {
      margin-right: 8px;
      vertical-align: middle;
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>
  `.trim()
}
