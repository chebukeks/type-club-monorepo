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

  // Кастомный обработчик для image (теперь блочная нода).
  // Markdown-it помещает image как inline-токен внутри paragraph.
  // Мы закрываем текущий paragraph, вставляем image как блок, и открываем новый paragraph.
  handlers.image = (state: any, tok: any) => {
    const src = tok.attrGet('src') || ''
    const alt = tok.children?.[0]?.content || tok.attrGet('alt') || null
    const title = tok.attrGet('title') || null

    // Закрываем открытый paragraph
    state.closeNode()
    // Добавляем image как блок
    state.addNode(schema.nodes.image, { src, alt, title })
    // Открываем новый paragraph для оставшихся inline-токенов
    state.openNode(schema.nodes.paragraph)
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
      state.write('$$\n' + node.textContent.trim() + '\n$$')
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
export function generateExportHtml(markdown: string, theme: 'dark' | 'light' = 'dark'): string {
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
  
  // Стили повторяют CSS-переменные из index.css и стили из editorTheme.ts,
  // чтобы экспорт выглядел идентично Preview режиму в редакторе.
  return `
<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Export</title>
  
  <!-- Шрифты, идентичные редактору -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;650;700&display=swap">
  
  <!-- KaTeX CSS для математики -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  
  <style>
    /* === Тёмная тема (по умолчанию) === */
    :root,
    [data-theme="dark"] {
      --bg-base: #1a1b1e;
      --bg-hover: #2a2d33;
      --bg-active: #313238;
      --text-primary: #e1e1e3;
      --text-muted: #a0a4ab;
      --editor-text: #e1e1e3;
      --editor-heading: #e8eaed;
      --editor-heading-h3: #d2d4d7;
      --editor-heading-h4: #c0c3c8;
      --editor-heading-h5: #b0b3b8;
      --editor-heading-h6: #9ca0a8;
      --editor-strong: #f0f0f2;
      --editor-em: #c8cad0;
      --editor-strike: #7b7d85;
      --editor-code-bg: rgba(108, 140, 255, 0.1);
      --editor-code-text: #8ca8ff;
      --editor-mark-bg: rgba(255, 215, 0, 0.2);
      --editor-mark-text: #ffd700;
      --editor-link: #5865f2;
      --editor-hr: #3a3d44;
      --editor-blockquote-border: #6c8cff;
      --editor-blockquote-text: #a0a4ab;
      --editor-blockquote-bg: rgba(108, 140, 255, 0.05);
      --codeblock-bg: #1e1e1e;
      --codeblock-border: #2d2e32;
      --codeblock-text: #e4e6eb;
      --table-border: #232428;
      --table-header-bg: #1e2025;
      --table-header-text: #e8eaed;
      --table-cell-bg: rgba(30, 32, 37, 0.3);
      --table-cell-text: #c8cad0;
      --table-even-bg: rgba(30, 32, 37, 0.5);
      --math-render: #abb2bf;
    }

    /* === Светлая тема === */
    [data-theme="light"] {
      --bg-base: #ffffff;
      --bg-hover: #e8e8e8;
      --bg-active: #d4d4d4;
      --text-primary: #1e1e1e;
      --text-muted: #6e6e6e;
      --editor-text: #1e1e1e;
      --editor-heading: #1e1e1e;
      --editor-heading-h3: #333333;
      --editor-heading-h4: #444444;
      --editor-heading-h5: #555555;
      --editor-heading-h6: #666666;
      --editor-strong: #1e1e1e;
      --editor-em: #333333;
      --editor-strike: #999999;
      --editor-code-bg: rgba(68, 114, 196, 0.08);
      --editor-code-text: #4472c4;
      --editor-mark-bg: rgba(255, 217, 0, 0.521);
      --editor-mark-text: #704e00;
      --editor-link: #4472c4;
      --editor-hr: #e0e0e0;
      --editor-blockquote-border: #4472c4;
      --editor-blockquote-text: #6e6e6e;
      --editor-blockquote-bg: rgba(68, 114, 196, 0.05);
      --codeblock-bg: #f5f5f5;
      --codeblock-border: #e0e0e0;
      --codeblock-text: #1e1e1e;
      --table-border: #e0e0e0;
      --table-header-bg: #f0f0f0;
      --table-header-text: #1e1e1e;
      --table-cell-bg: transparent;
      --table-cell-text: #333333;
      --table-even-bg: rgba(0, 0, 0, 0.02);
      --math-render: #333333;
    }

    /* === Базовые стили (идентичны ProseMirror в Preview) === */
    html {
      background-color: var(--bg-base);
    }
    body {
      font-family: 'Inter', 'SF Pro Text', -apple-system, sans-serif;
      font-size: 15px;
      line-height: 1.75;
      color: var(--editor-text);
      background-color: var(--bg-base);
      max-width: 860px;
      margin: 0 auto;
      padding: 24px 48px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* Печать / PDF: убираем белые рамки, фон заливает всю страницу */
    @page {
      margin: 0;
      size: A4;
    }
    @media print {
      body {
        max-width: none;
        padding: 1.5cm 2cm;
      }
    }

    /* Заголовки */
    h1 { font-size: 2em; font-weight: 700; color: var(--editor-heading); line-height: 1.3; margin: 1em 0 0.4em 0; }
    h2 { font-size: 1.5em; font-weight: 650; color: var(--editor-heading); line-height: 1.35; margin: 0.8em 0 0.3em 0; }
    h3 { font-size: 1.25em; font-weight: 600; color: var(--editor-heading-h3); line-height: 1.4; margin: 0.7em 0 0.3em 0; }
    h4 { font-size: 1.1em; font-weight: 600; color: var(--editor-heading-h4); line-height: 1.45; margin: 0.6em 0 0.3em 0; }
    h5 { font-size: 1.05em; font-weight: 600; color: var(--editor-heading-h5); line-height: 1.5; margin: 0.5em 0 0.2em 0; }
    h6 { font-size: 1em; font-weight: 600; color: var(--editor-heading-h6); line-height: 1.5; margin: 0.5em 0 0.2em 0; }

    p { margin: 0 0 0.5em 0; }

    /* Ссылки */
    a { color: var(--editor-link); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* Inline стили */
    strong { font-weight: 700; color: var(--editor-strong); }
    em { color: var(--editor-em); }
    s { text-decoration: line-through; color: var(--editor-strike); }
    mark { background: var(--editor-mark-bg); color: var(--editor-mark-text); border-radius: 3px; padding: 0 2px; }

    /* Inline code */
    code {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      background: var(--editor-code-bg);
      border-radius: 4px;
      padding: 1px 6px;
      font-size: 0.88em;
      color: var(--editor-code-text);
    }

    /* Блоки кода */
    pre {
      background: var(--codeblock-bg);
      border-radius: 8px;
      margin: 16px 0;
      padding: 16px;
      overflow: auto;
      border: 1px solid var(--codeblock-border);
    }
    pre code {
      background: transparent;
      padding: 0;
      border-radius: 0;
      font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
      font-size: 14px;
      line-height: 1.5;
      color: var(--codeblock-text);
    }

    /* Цитаты */
    blockquote {
      border-left: 4px solid var(--editor-blockquote-border);
      padding: 8px 16px;
      margin: 16px 0;
      color: var(--editor-blockquote-text);
      background: var(--editor-blockquote-bg);
      border-radius: 0 4px 4px 0;
    }
    blockquote p { margin-bottom: 0.5em; color: inherit; }
    blockquote p:last-child { margin-bottom: 0; }

    /* Списки */
    ul, ol { padding-left: 24px; margin: 8px 0; }
    ul { list-style-type: disc; }
    ol { list-style-type: decimal; }
    li { margin-bottom: 4px; line-height: 1.6; }

    /* Task list */
    .task-list-item { list-style-type: none; }
    .task-list-item input[type="checkbox"] {
      margin-right: 8px;
      vertical-align: middle;
    }

    /* Таблицы */
    table {
      border-collapse: separate;
      border-spacing: 0;
      width: 100%;
      margin: 12px 0;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--codeblock-border);
    }
    th, td {
      padding: 8px 16px;
      border-bottom: 1px solid var(--table-border);
      border-right: 1px solid var(--table-border);
      vertical-align: top;
    }
    th:last-child, td:last-child { border-right: none; }
    tbody tr:last-child td { border-bottom: none; }
    th {
      background: var(--table-header-bg);
      font-weight: 600;
      color: var(--table-header-text);
      border-bottom: 2px solid var(--codeblock-border);
    }
    td { background: var(--table-cell-bg); color: var(--table-cell-text); }
    tbody tr:nth-child(even) td { background: var(--table-even-bg); }

    /* Горизонтальная линия */
    hr { border: none; border-top: 1px solid var(--editor-hr); margin: 16px 0; }

    /* Изображения */
    img {
      max-width: 100%;
      border-radius: 6px;
      display: block;
      margin: 12px auto;
    }

    /* Спойлеры (отображаются открытыми в экспорте) */
    .pm-spoiler {
      background: var(--bg-hover);
      border-radius: 4px;
      padding: 0 4px;
    }

    /* KaTeX: скрыть дубликат MathML */
    .katex-mathml {
      position: absolute;
      clip: rect(1px, 1px, 1px, 1px);
      padding: 0; border: 0;
      height: 1px; width: 1px;
      overflow: hidden;
    }
    .katex-display {
      overflow-x: auto;
      overflow-y: hidden;
      padding: 1rem 0;
    }
    .katex { color: var(--math-render); }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>
  `.trim()
}
