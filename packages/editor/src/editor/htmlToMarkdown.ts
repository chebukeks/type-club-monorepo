/**
 * htmlToMarkdown.ts — Умный препроцессор HTML → Markdown для буфера обмена
 *
 * Преобразует rich HTML (выделенный мышкой на сайтах, в AI-чатах, документах)
 * в чистый Markdown со всей семантикой:
 * 1. Формулы KaTeX / MathML / MathJax / Gemini → $...$ и $$...$$
 * 2. Блоки кода (с очисткой UI-кнопок Copy и определением языка) → ```lang\n...\n```
 * 3. HTML-таблицы <table> → Markdown-таблицы | col | col |
 * 4. Заголовки, списки, чек-листы (- [x]), цитаты (>), спойлеры (||), маркеры (==)
 */

/** Проверка, содержит ли HTML содержательную разметку (не просто пустые обёртки) */
export function isMeaningfulHtml(html: string): boolean {
  if (!html || typeof html !== 'string') return false
  const lower = html.toLowerCase()
  return (
    lower.includes('<table') ||
    lower.includes('<pre') ||
    lower.includes('<code') ||
    lower.includes('class="katex') ||
    lower.includes('class="math-') ||
    lower.includes('data-math') ||
    lower.includes('<math') ||
    lower.includes('<h1') ||
    lower.includes('<h2') ||
    lower.includes('<h3') ||
    lower.includes('<h4') ||
    lower.includes('<h5') ||
    lower.includes('<h6') ||
    lower.includes('<ul') ||
    lower.includes('<ol') ||
    lower.includes('<blockquote') ||
    lower.includes('<strong') ||
    lower.includes('<b') ||
    lower.includes('<em') ||
    lower.includes('<i') ||
    lower.includes('<del') ||
    lower.includes('<s') ||
    lower.includes('<mark') ||
    lower.includes('<a ') ||
    lower.includes('<img ') ||
    lower.includes('<hr')
  )
}

/**
 * Главная функция: HTML string → Clean Markdown string
 */
export function htmlToMarkdown(html: string): string {
  if (!html || typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return ''
  }

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const body = doc.body
    if (!body) return ''

    // Шаг 1. Очистка и извлечение специальных сущностей (KaTeX, MathML, Code UI)
    preprocessMath(body)
    preprocessCodeBlocks(body)
    cleanupUiArtifacts(body)

    // Шаг 2. Рекурсивная сериализация DOM в Markdown
    const markdown = serializeNode(body).trim()

    // Шаг 3. Нормализация переносов строк
    return markdown
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  } catch (err) {
    console.error('Ошибка в htmlToMarkdown:', err)
    return ''
  }
}

// ─────────────────────────────────────────────────────────────
// Препроцессинг: Математика (KaTeX, MathML, MathJax, Gemini)
// ─────────────────────────────────────────────────────────────

function preprocessMath(root: HTMLElement): void {
  // 1. Блочные формулы: .katex-display, .math-block, [data-math-display]
  const displays = root.querySelectorAll('.katex-display, .math-block, [data-math-display]')
  displays.forEach((display) => {
    const tex = extractLatexFromElement(display)
    if (tex) {
      const placeholder = root.ownerDocument.createElement('div')
      placeholder.setAttribute('data-tc-math-display', 'true')
      placeholder.textContent = tex
      display.replaceWith(placeholder)
    }
  })

  // 2. Инлайн формулы: .katex, .math-inline, [data-math]
  const inlines = root.querySelectorAll('.katex, .math-inline, [data-math]')
  inlines.forEach((node) => {
    const tex = extractLatexFromElement(node)
    if (tex) {
      const placeholder = root.ownerDocument.createElement('span')
      placeholder.setAttribute('data-tc-math-inline', 'true')
      placeholder.textContent = tex
      node.replaceWith(placeholder)
    }
  })

  // 3. Чистый MathML: <math display="block"> или <math>
  const mathNodes = root.querySelectorAll('math')
  mathNodes.forEach((math) => {
    const isBlock = math.getAttribute('display') === 'block'
    const tex = extractLatexFromElement(math)
    if (tex) {
      const placeholder = root.ownerDocument.createElement(isBlock ? 'div' : 'span')
      placeholder.setAttribute(isBlock ? 'data-tc-math-display' : 'data-tc-math-inline', 'true')
      placeholder.textContent = tex
      math.replaceWith(placeholder)
    }
  })

  // 4. MathJax контейнеры: mjx-container
  const mjxNodes = root.querySelectorAll('mjx-container')
  mjxNodes.forEach((mjx) => {
    const isBlock = mjx.getAttribute('display') === 'true'
    const tex = mjx.getAttribute('data-tex') || extractLatexFromElement(mjx)
    if (tex) {
      const placeholder = root.ownerDocument.createElement(isBlock ? 'div' : 'span')
      placeholder.setAttribute(isBlock ? 'data-tc-math-display' : 'data-tc-math-inline', 'true')
      placeholder.textContent = tex
      mjx.replaceWith(placeholder)
    }
  })
}

/** Извлечение LaTeX кода из KaTeX / MathML / Gemini структуры */
function extractLatexFromElement(el: Element): string {
  // А) Атрибуты data-math, data-tex, data-latex
  const attrTex = el.getAttribute('data-math') || el.getAttribute('data-tex') || el.getAttribute('data-latex')
  if (attrTex) {
    return attrTex.replace(/^\$\$|\$\$$|^\\\(|\\\)$|^\\\[|\\\]$|^\$|\$$/g, '').trim()
  }

  // Б) KaTeX / MathML <annotation encoding="application/x-tex">...</annotation>
  const annotation = el.querySelector('annotation[encoding="application/x-tex"], annotation')
  if (annotation && annotation.textContent) {
    return annotation.textContent.trim()
  }

  // В) Если это span с классом katex-mathml
  const mathml = el.querySelector('.katex-mathml')
  if (mathml) {
    const ann = mathml.querySelector('annotation')
    if (ann && ann.textContent) return ann.textContent.trim()
  }

  // Г) Fallback: проверка текста на $...$ или $$...$$
  const text = el.textContent?.trim() || ''
  if (text.startsWith('$') && text.endsWith('$')) {
    return text.replace(/^\$\$|\$\$$|^\$|\$$/g, '').trim()
  }

  return ''
}

// ─────────────────────────────────────────────────────────────
// Препроцессинг: Блоки кода и UI-артефакты
// ─────────────────────────────────────────────────────────────

function preprocessCodeBlocks(root: HTMLElement): void {
  // Обработка блоков кода (ChatGPT .code-block, Gemini .code-block, стандартные <pre>)
  const codeBlocks = Array.from(root.querySelectorAll('.code-block, pre'))
  for (const block of codeBlocks) {
    if (block.getAttribute('data-tc-code-processed')) continue

    const pre = block.tagName.toLowerCase() === 'pre' ? (block as HTMLPreElement) : block.querySelector('pre')
    if (!pre) continue

    let language = ''

    // 1. Ищем язык в классах <code class="language-typescript"> или <pre class="language-...">
    const codeEl = pre.querySelector('code') || pre
    const codeClass = `${codeEl.className || ''} ${pre.className || ''}`
    const langMatch = codeClass.match(/(?:language|lang|hljs-)-?([a-zA-Z0-9_-]+)/i)
    if (langMatch && langMatch[1] !== 'container' && langMatch[1] !== 'formatted') {
      language = langMatch[1]
    }

    // 2. Ищем язык в шапках и декорациях (Gemini .code-block-decoration, ChatGPT .code-header)
    if (!language) {
      const headerEl = (block !== pre ? block : pre.parentElement)?.querySelector(
        '.code-block-decoration, .code-header, [class*="header"], [class*="decoration"], [class*="language"]'
      )
      if (headerEl) {
        const clone = headerEl.cloneNode(true) as HTMLElement
        clone.querySelectorAll('button, svg, [role="button"]').forEach((b) => b.remove())
        const text = clone.textContent?.trim().toLowerCase() || ''
        if (text && text.length < 25 && !text.includes('copy') && !text.includes('копир') && !text.includes('скачать')) {
          language = text.split(/\s+/)[0]
        }
      }
    }

    // Извлекаем чистый текст кода
    const codeText = (codeEl.textContent || pre.textContent || '')
      .replace(/\r\n/g, '\n')
      .replace(/\n$/, '')

    const placeholder = root.ownerDocument.createElement('div')
    placeholder.setAttribute('data-tc-code-block', 'true')
    placeholder.setAttribute('data-tc-lang', language)
    placeholder.textContent = codeText

    pre.setAttribute('data-tc-code-processed', 'true')

    if (block !== pre) {
      block.replaceWith(placeholder)
    } else {
      const parent = pre.parentElement
      if (
        parent &&
        parent !== root &&
        parent.tagName === 'DIV' &&
        parent.querySelectorAll('pre').length === 1 &&
        parent.children.length <= 3
      ) {
        parent.replaceWith(placeholder)
      } else {
        pre.replaceWith(placeholder)
      }
    }
  }
}

function cleanupUiArtifacts(root: HTMLElement): void {
  // Удаляем кнопки, скрытые элементы, скрипты, стили, SVG иконки
  const removeSelectors = [
    'button',
    'svg',
    'script',
    'style',
    'noscript',
    'template',
    '[aria-hidden="true"]:not(.katex-html)',
    '.copy-button',
    '.copy-code-button',
    '[class*="copy-button"]',
    '[class*="CopyButton"]',
  ]
  root.querySelectorAll(removeSelectors.join(', ')).forEach((el) => el.remove())
}

// ─────────────────────────────────────────────────────────────
// Сериализатор DOM-дерева в Markdown
// ─────────────────────────────────────────────────────────────

function serializeNode(node: Node, insideList = false): string {
  // Текстовый узел
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || ''
  }

  // Не элемент — игнорируем
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return ''
  }

  const el = node as HTMLElement
  const tagName = el.tagName.toLowerCase()

  // 1. Кастомные блочные плейсхолдеры
  if (el.getAttribute('data-tc-math-display') === 'true') {
    const tex = el.textContent?.trim() || ''
    return `\n\n$$\n${tex}\n$$\n\n`
  }

  if (el.getAttribute('data-tc-math-inline') === 'true') {
    const tex = el.textContent?.trim() || ''
    return `$${tex}$`
  }

  if (el.getAttribute('data-tc-code-block') === 'true') {
    const lang = el.getAttribute('data-tc-lang') || ''
    const code = el.textContent || ''
    return `\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`
  }

  // 2. Стандартные теги
  switch (tagName) {
    // --- Заголовки ---
    case 'h1': return `\n\n# ${serializeChildren(el).trim()}\n\n`
    case 'h2': return `\n\n## ${serializeChildren(el).trim()}\n\n`
    case 'h3': return `\n\n### ${serializeChildren(el).trim()}\n\n`
    case 'h4': return `\n\n#### ${serializeChildren(el).trim()}\n\n`
    case 'h5': return `\n\n##### ${serializeChildren(el).trim()}\n\n`
    case 'h6': return `\n\n###### ${serializeChildren(el).trim()}\n\n`

    // --- Параграфы и блоки ---
    case 'p': {
      const content = serializeChildren(el).trim()
      if (!content) return ''
      return insideList ? `${content}\n` : `\n\n${content}\n\n`
    }

    case 'br':
      return '\n'

    case 'hr':
      return '\n\n---\n\n'

    case 'blockquote': {
      const inner = serializeChildren(el).trim()
      const quoted = inner
        .split('\n')
        .map((line) => (line.trim() ? `> ${line}` : '>'))
        .join('\n')
      return `\n\n${quoted}\n\n`
    }

    // --- Инлайн-стили ---
    case 'strong':
    case 'b': {
      const content = serializeChildren(el)
      if (!content.trim()) return content
      return `**${content}**`
    }

    case 'em':
    case 'i': {
      const content = serializeChildren(el)
      if (!content.trim()) return content
      return `*${content}*`
    }

    case 'del':
    case 's':
    case 'strike': {
      const content = serializeChildren(el)
      if (!content.trim()) return content
      return `~~${content}~~`
    }

    case 'mark': {
      const content = serializeChildren(el)
      if (!content.trim()) return content
      return `==${content}==`
    }

    case 'code': {
      const content = el.textContent || ''
      if (!content) return ''
      return `\`${content}\``
    }

    // --- Ссылки и изображения ---
    case 'a': {
      const href = el.getAttribute('href') || ''
      const title = el.getAttribute('title') ? ` "${el.getAttribute('title')}"` : ''
      const content = serializeChildren(el).trim()
      if (!href) return content
      return `[${content || href}](${href}${title})`
    }

    case 'img': {
      const src = el.getAttribute('src') || ''
      const alt = el.getAttribute('alt') || ''
      const title = el.getAttribute('title') ? ` "${el.getAttribute('title')}"` : ''
      if (!src) return ''
      return `\n\n![${alt}](${src}${title})\n\n`
    }

    // --- Таблицы ---
    case 'table':
      return serializeTable(el)

    // --- Списки ---
    case 'ul':
      return serializeList(el, false)

    case 'ol':
      return serializeList(el, true)

    case 'li':
      return serializeListItem(el)

    // --- Контейнеры общего назначения ---
    case 'div':
    case 'section':
    case 'article':
    case 'aside':
    case 'header':
    case 'footer': {
      // Проверка на спойлер
      if (el.classList.contains('pm-spoiler') || el.getAttribute('data-spoiler')) {
        return `||${serializeChildren(el)}||`
      }
      const inner = serializeChildren(el)
      return insideList ? inner : `\n${inner}\n`
    }

    case 'span': {
      if (el.classList.contains('pm-spoiler') || el.getAttribute('data-spoiler')) {
        return `||${serializeChildren(el)}||`
      }
      return serializeChildren(el)
    }

    default:
      return serializeChildren(el)
  }
}

/** Сериализация всех дочерних узлов элемента */
function serializeChildren(el: HTMLElement, insideList = false): string {
  let result = ''
  for (let i = 0; i < el.childNodes.length; i++) {
    result += serializeNode(el.childNodes[i], insideList)
  }
  return result
}

// ─────────────────────────────────────────────────────────────
// Сериализация списков
// ─────────────────────────────────────────────────────────────

function serializeList(listEl: HTMLElement, isOrdered: boolean): string {
  let result = '\n\n'
  const items = Array.from(listEl.children).filter((c) => c.tagName.toLowerCase() === 'li') as HTMLElement[]
  const startOrder = Number(listEl.getAttribute('start')) || 1

  items.forEach((item, index) => {
    const prefix = isOrdered ? `${startOrder + index}. ` : '- '
    const itemContent = serializeListItem(item).trim()
    result += `${prefix}${itemContent}\n`
  })

  return `${result}\n`
}

function serializeListItem(li: HTMLElement): string {
  // Проверка на чек-лист (task list item)
  const checkbox = li.querySelector('input[type="checkbox"]') as HTMLInputElement | null
  const isChecked = checkbox
    ? checkbox.checked || checkbox.hasAttribute('checked')
    : li.getAttribute('data-checked') === 'true' || li.classList.contains('checked')

  const hasTaskCheckbox = checkbox !== null || li.hasAttribute('data-checked') || li.classList.contains('task-list-item')

  // Удаляем инпут чекбокса, чтобы он не мешал тексту
  if (checkbox) {
    checkbox.remove()
  }

  let text = serializeChildren(li, true).trim()

  // Если в начале текста уже есть [ ] или [x] — не дублируем
  if (hasTaskCheckbox) {
    if (!text.startsWith('[ ]') && !text.startsWith('[x]') && !text.startsWith('[X]')) {
      text = `${isChecked ? '[x]' : '[ ]'} ${text}`
    }
  }

  return text
}

// ─────────────────────────────────────────────────────────────
// Сериализация таблиц <table> → Markdown Table
// ─────────────────────────────────────────────────────────────

function serializeTable(table: HTMLElement): string {
  const rows: string[][] = []

  // Собираем все строки таблицы (из thead, tbody или напрямую)
  const trElements = Array.from(table.querySelectorAll('tr'))
  if (trElements.length === 0) return ''

  for (const tr of trElements) {
    const cells: string[] = []
    const cellElements = Array.from(tr.querySelectorAll('th, td')) as HTMLElement[]
    for (const cell of cellElements) {
      // Сериализуем инлайн контент ячейки
      let cellText = serializeChildren(cell).trim()
      // Внутри ячеек Markdown-таблицы переносы строк заменяем на пробелы, а пайпы | экранируем
      cellText = cellText.replace(/\n+/g, ' ').replace(/\|/g, '\\|')
      cells.push(cellText)
    }
    if (cells.length > 0) {
      rows.push(cells)
    }
  }

  if (rows.length === 0) return ''

  // Определяем максимальное количество колонок
  const colCount = Math.max(...rows.map((r) => r.length))
  if (colCount === 0) return ''

  // Дополняем короткие строки пустыми ячейками
  for (const row of rows) {
    while (row.length < colCount) {
      row.push('')
    }
  }

  let tableMarkdown = '\n\n'

  // Первая строка — заголовок
  const headerRow = rows[0]
  tableMarkdown += `| ${headerRow.join(' | ')} |\n`

  // Разделитель
  const separator = Array(colCount).fill('---').join(' | ')
  tableMarkdown += `| ${separator} |\n`

  // Тело таблицы
  for (let i = 1; i < rows.length; i++) {
    tableMarkdown += `| ${rows[i].join(' | ')} |\n`
  }

  tableMarkdown += '\n'
  return tableMarkdown
}
