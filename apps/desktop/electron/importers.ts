import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import JSZip from 'jszip'
import mammoth from 'mammoth'

const requireModule = createRequire(import.meta.url)

/**
 * Очистка и реконструкция связного текста из PDF:
 * 1. Удаление номеров страниц и колонтитулов
 * 2. Склейка перенесённых по слогам слов (на конце строки с дефисом)
 * 3. Объединение строк одного абзаца в единый поток
 * 4. Сохранение логических абзацев через пустую строку
 */
export function cleanPdfText(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return ''

  // 1. Нормализация переносов строк
  let text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // 2. Удаление колонтитулов и номеров страниц
  // Примеры: "Page 1 of 10", "Страница 1", "- 12 -", одиночные числа на отдельной строке
  text = text.replace(/^[ \t]*(?:Страница|Page)\s+\d+(?:\s*(?:из|of)\s*\d+)?[ \t]*$/gmi, '')
  text = text.replace(/^[ \t]*[-–—]\s*\d+\s*[-–—][ \t]*$/gm, '')
  text = text.replace(/^[ \t]*\d{1,4}[ \t]*$/gm, '')

  // 3. Склейка слов, разбитых переносом на конце строки (исследо-\nвание -> исследование)
  text = text.replace(/([а-яa-zА-ЯA-Z0-9])-[\t ]*\n[\t ]*([а-яa-zА-ЯA-Z0-9])/g, '$1$2')

  // 4. Построчная реконструкция абзацев
  const rawLines = text.split('\n')
  const paragraphs: string[] = []
  let currentParagraphLines: string[] = []

  const isListOrHeading = (line: string): boolean => {
    return /^(\s*[-*+•–]\s+|\s*\d+[.)]\s+|#{1,6}\s+)/.test(line)
  }

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim()

    // Пустая строка — явный конец абзаца
    if (!line) {
      if (currentParagraphLines.length > 0) {
        paragraphs.push(currentParagraphLines.join(' '))
        currentParagraphLines = []
      }
      continue
    }

    // Если строка выглядит как начало списка или заголовка
    if (isListOrHeading(line)) {
      if (currentParagraphLines.length > 0) {
        paragraphs.push(currentParagraphLines.join(' '))
        currentParagraphLines = []
      }
      currentParagraphLines.push(line)
      continue
    }

    // Если предыдущая строка заканчивалась знаком завершения предложения (. ! ? :)
    // и текущая строка начинается с заглавной буквы — вероятно, новый абзац
    if (currentParagraphLines.length > 0) {
      const prev = currentParagraphLines[currentParagraphLines.length - 1]
      const prevEndsSentence = /[.!?:]$/.test(prev)
      const currentStartsCapital = /^[А-ЯA-ZЁ]/.test(line)

      if (prevEndsSentence && currentStartsCapital && (prev.length < 50 || isListOrHeading(prev))) {
        paragraphs.push(currentParagraphLines.join(' '))
        currentParagraphLines = [line]
        continue
      }
    }

    currentParagraphLines.push(line)
  }

  if (currentParagraphLines.length > 0) {
    paragraphs.push(currentParagraphLines.join(' '))
  }

  // 5. Итоговая сборка абзацев с двойным переносом
  return paragraphs
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .join('\n\n')
}

/**
 * Рекурсивное преобразование формул из формата Word OMML XML в LaTeX разметку
 */
export function ommlToLatex(xmlNode: string): string {
  if (!xmlNode) return ''

  function parseNode(str: string): string {
    if (!str) return ''

    // 1. Дроби: <m:f>...<m:num>...</m:num>...<m:den>...</m:den>...</m:f>
    str = str.replace(
      /<m:f\b[^>]*>[\s\S]*?<m:num\b[^>]*>([\s\S]*?)<\/m:num>[\s\S]*?<m:den\b[^>]*>([\s\S]*?)<\/m:den>[\s\S]*?<\/m:f>/g,
      (_, num, den) => `\\frac{${parseNode(num)}}{${parseNode(den)}}`
    )

    // 2. Верхний индекс (степень): <m:sSup>...<m:e>...</m:e>...<m:sup>...</m:sup>...</m:sSup>
    str = str.replace(
      /<m:sSup\b[^>]*>[\s\S]*?<m:e\b[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<m:sup\b[^>]*>([\s\S]*?)<\/m:sup>[\s\S]*?<\/m:sSup>/g,
      (_, e, sup) => `{${parseNode(e)}}^{${parseNode(sup)}}`
    )

    // 3. Нижний индекс: <m:sSub>...<m:e>...</m:e>...<m:sub>...</m:sub>...</m:sSub>
    str = str.replace(
      /<m:sSub\b[^>]*>[\s\S]*?<m:e\b[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<m:sub\b[^>]*>([\s\S]*?)<\/m:sub>[\s\S]*?<\/m:sSub>/g,
      (_, e, sub) => `{${parseNode(e)}}_{${parseNode(sub)}}`
    )

    // 4. Двойной индекс (sub-sup): <m:sSubSup>
    str = str.replace(
      /<m:sSubSup\b[^>]*>[\s\S]*?<m:e\b[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<m:sub\b[^>]*>([\s\S]*?)<\/m:sub>[\s\S]*?<m:sup\b[^>]*>([\s\S]*?)<\/m:sup>[\s\S]*?<\/m:sSubSup>/g,
      (_, e, sub, sup) => `{${parseNode(e)}}_{${parseNode(sub)}}^{${parseNode(sup)}}`
    )

    // 5. Радикалы (корни): <m:rad>
    str = str.replace(
      /<m:rad\b[^>]*>[\s\S]*?(?:<m:deg\b[^>]*>([\s\S]*?)<\/m:deg>)?[\s\S]*?<m:e\b[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<\/m:rad>/g,
      (_, deg, e) => {
        const cleanDeg = parseNode(deg || '').trim()
        return cleanDeg ? `\\sqrt[${cleanDeg}]{${parseNode(e)}}` : `\\sqrt{${parseNode(e)}}`
      }
    )

    // 6. Скобки / разделители: <m:d>
    str = str.replace(
      /<m:d\b[^>]*>[\s\S]*?<m:e\b[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<\/m:d>/g,
      (_, e) => `(${parseNode(e)})`
    )

    // 7. Извлечение текста формулы из тегов <m:t>
    str = str.replace(/<m:t\b[^>]*>([\s\S]*?)<\/m:t>/g, '$1')

    // 8. Удаление оставшихся внутренних служебных тегов
    str = str.replace(/<[^>]+>/g, '')

    return str
  }

  return parseNode(xmlNode).trim()
}

/**
 * Предобработка document.xml внутри docx архива:
 * Преобразует уравнения Office OpenXML Math (<m:oMath>, <m:oMathPara>) в текстовые формулы LaTeX,
 * чтобы Mammoth не терял их при парсинге в HTML.
 */
export async function preprocessDocxMath(buffer: Buffer): Promise<Buffer> {
  try {
    const zip = await JSZip.loadAsync(buffer)
    const docXmlFile = zip.file('word/document.xml')
    if (!docXmlFile) return buffer

    let xml = await docXmlFile.async('string')

    // Обработка строго абзац за абзацем во избежание захвата соседних параграфов
    xml = xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (pXml) => {
      if (!pXml.includes('<m:oMath')) return pXml

      const isCentered = pXml.includes('<w:jc w:val="center"/>') || pXml.includes('<m:oMathPara')
      const nonMathText = pXml
        .replace(/<w:pPr\b[\s\S]*?<\/w:pPr>/g, '')
        .replace(/<m:oMath\b[\s\S]*?<\/m:oMath>/g, '')
        .replace(/<m:oMathPara\b[\s\S]*?<\/m:oMathPara>/g, '')
        .replace(/<[^>]+>/g, '')
        .trim()

      // Если в абзаце нет текста кроме формулы (или формула выровнена по центру) — это блочная формула
      if ((isCentered || !nonMathText) && !nonMathText) {
        return pXml.replace(/<m:oMath\b[\s\S]*?>([\s\S]*?)<\/m:oMath>/g, (_, inner) => {
          const tex = ommlToLatex(inner)
          return `<w:r><w:t xml:space="preserve">$$\n${tex}\n$$</w:t></w:r>`
        })
      }

      // Иначе — строчная (инлайн) формула
      return pXml.replace(/<m:oMath\b[\s\S]*?>([\s\S]*?)<\/m:oMath>/g, (_, inner) => {
        const tex = ommlToLatex(inner)
        return `<w:r><w:t xml:space="preserve">$${tex}$</w:t></w:r>`
      })
    })

    zip.file('word/document.xml', xml)
    return await zip.generateAsync({ type: 'nodebuffer' })
  } catch (err) {
    console.error('Ошибка в preprocessDocxMath:', err)
    return buffer
  }
}

/**
 * Конвертер HTML (из Mammoth или внешних файлов) в чистый, валидный Markdown
 * с полной поддержкой таблиц, формул, списков, цитат, картинок, ссылок и заголовков.
 */
export function mammothHtmlToMarkdown(html: string): string {
  if (!html || typeof html !== 'string') return ''

  let text = html.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // 1. Блоки кода: <pre><code>...</code></pre>
  text = text.replace(/<pre\b[^>]*><code\b[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, code) => {
    const clean = code
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
    return `\n\n\`\`\`\n${clean.trim()}\n\`\`\`\n\n`
  })

  // 2. Таблицы: <table>...</table>
  text = text.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_, tableContent) => {
    const rows: string[][] = []
    const trMatches = tableContent.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)

    for (const trMatch of trMatches) {
      const cells: string[] = []
      const cellMatches = trMatch[1].matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)
      for (const cellMatch of cellMatches) {
        let cellText = cellMatch[1]
          .replace(/<p\b[^>]*>/gi, '')
          .replace(/<\/p>/gi, ' ')
          .replace(/<br\s*\/?>/gi, ' ')
          .replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**')
          .replace(/<em>([\s\S]*?)<\/em>/gi, '*$1*')
          .replace(/<s>([\s\S]*?)<\/s>/gi, '~~$1~~')
          .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
          .replace(/<[^>]+>/g, '')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, ' ')
          .trim()
          .replace(/\n+/g, ' ')
          .replace(/\|/g, '\\|')
        cells.push(cellText)
      }
      if (cells.length > 0) rows.push(cells)
    }

    if (rows.length === 0) return ''

    const colCount = Math.max(...rows.map((r) => r.length))
    for (const row of rows) {
      while (row.length < colCount) row.push('')
    }

    let mdTable = '\n\n| ' + rows[0].join(' | ') + ' |\n'
    mdTable += '| ' + Array(colCount).fill('---').join(' | ') + ' |\n'
    for (let r = 1; r < rows.length; r++) {
      mdTable += '| ' + rows[r].join(' | ') + ' |\n'
    }
    return mdTable + '\n'
  })

  // 3. Списки: <ul> и <ol>
  function parseList(listHtml: string, isOrdered: boolean, indentLevel = 0): string {
    let result = ''
    let count = 1
    const indent = '  '.repeat(indentLevel)

    const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi
    let liMatch: RegExpExecArray | null
    while ((liMatch = liRegex.exec(listHtml)) !== null) {
      let content = liMatch[1]

      // Рекурсивный поиск вложенных списков
      let nestedMd = ''
      content = content.replace(/<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, tag, inner) => {
        nestedMd += parseList(inner, tag.toLowerCase() === 'ol', indentLevel + 1)
        return ''
      })

      content = cleanInline(content).trim()
      const prefix = isOrdered ? `${count++}. ` : '- '
      result += `${indent}${prefix}${content}\n`
      if (nestedMd) result += nestedMd
    }
    return result
  }

  text = text.replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) => '\n\n' + parseList(inner, false, 0) + '\n')
  text = text.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => '\n\n' + parseList(inner, true, 0) + '\n')

  // 4. Цитаты: <blockquote>...</blockquote>
  text = text.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
    const clean = cleanInline(inner).trim()
    const lines = clean.split('\n').map((l) => (l.trim() ? `> ${l.trim()}` : '>')).join('\n')
    return `\n\n${lines}\n\n`
  })

  // 5. Заголовки: <h1> - <h6>
  for (let level = 6; level >= 1; level--) {
    const hRegex = new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi')
    text = text.replace(hRegex, (_, inner) => {
      let clean = cleanInline(inner).trim()
      // Снимаем избыточное полужирное выделение заголовка
      if (clean.startsWith('**') && clean.endsWith('**')) {
        clean = clean.slice(2, -2).trim()
      }
      return `\n\n${'#'.repeat(level)} ${clean}\n\n`
    })
  }

  // 6. Горизонтальная линия: <hr />
  text = text.replace(/<hr\s*\/?>/gi, '\n\n---\n\n')

  // 7. Изображения: <img>
  text = text.replace(/<img\b[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '\n\n![$2]($1)\n\n')
  text = text.replace(/<img\b[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, '\n\n![$1]($2)\n\n')
  text = text.replace(/<img\b[^>]*src="([^"]*)"[^>]*\/?>/gi, '\n\n![]($1)\n\n')

  // 8. Ссылки: <a>
  text = text.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
    return `[${cleanInline(inner).trim()}](${href})`
  })

  // 9. Абзацы: <p>
  text = text.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_, inner) => {
    const clean = cleanInline(inner).trim()
    return clean ? `\n\n${clean}\n\n` : ''
  })

  function cleanInline(str: string): string {
    if (!str) return ''
    let s = str
    s = s.replace(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    s = s.replace(/<b\b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    s = s.replace(/<em\b[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    s = s.replace(/<i\b[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    s = s.replace(/<(?:s|del|strike)\b[^>]*>([\s\S]*?)<\/(?:s|del|strike)>/gi, '~~$1~~')
    s = s.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    s = s.replace(/<br\s*\/?>/gi, '\n')
    s = s.replace(/<[^>]+>/g, '')
    s = s.replace(/&lt;/g, '<')
    s = s.replace(/&gt;/g, '>')
    s = s.replace(/&amp;/g, '&')
    s = s.replace(/&quot;/g, '"')
    s = s.replace(/&#39;/g, "'")
    s = s.replace(/&nbsp;/g, ' ')
    return s
  }

  text = text.replace(/<[^>]+>/g, '')
  text = text.replace(/\n{3,}/g, '\n\n')
  return text.trim()
}

/**
 * Импорт PDF-файла из буфера
 */
export async function importPdfBuffer(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PDFParse } = requireModule('pdf-parse')
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    await parser.destroy()
    return cleanPdfText(result.text || '')
  } catch (err) {
    console.error('Ошибка импорта PDF:', err)
    throw new Error(`Не удалось прочитать PDF-документ: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Импорт DOCX-файла из буфера с сохранением формул, таблиц, стилей и извлечением картинок в base64
 */
export async function importDocxBuffer(buffer: Buffer): Promise<string> {
  try {
    // 1. Извлекаем формулы из OMML XML
    const preprocessedBuffer = await preprocessDocxMath(buffer)

    
    const options = {
      styleMap: [
        "p[style-name='CodeBlock'] => pre > code:fresh",
        "p[style-name='Quote'] => blockquote:fresh",
        "r[style-name='Code'] => code",
      ],
      convertImage: mammoth.images.imgElement(async (element: any) => {
        const base64 = await element.read('base64')
        return {
          src: `data:${element.contentType};base64,${base64}`,
        }
      }),
    }
    const result = await mammoth.convertToHtml({ buffer: preprocessedBuffer }, options)
    return mammothHtmlToMarkdown(result.value || '')
  } catch (err) {
    console.error('Ошибка импорта DOCX:', err)
    throw new Error(`Не удалось сконвертировать Word-документ (.docx): ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Импорт HTML-файла из буфера в Markdown
 */
export function importHtmlBuffer(buffer: Buffer): string {
  const html = buffer.toString('utf-8')
  return mammothHtmlToMarkdown(html)
}

/**
 * Импорт TXT-файла из буфера (UTF-8 с обработкой BOM)
 */
export function importTxtBuffer(buffer: Buffer): string {
  // Проверка на UTF-8 BOM (0xEF, 0xBB, 0xBF)
  let start = 0
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    start = 3
  }
  return buffer.subarray(start).toString('utf-8')
}

/**
 * Универсальный импорт любого поддерживаемого файла по пути
 */
export async function importFileFromPath(filePath: string): Promise<{ fileName: string; content: string }> {
  const ext = path.extname(filePath).toLowerCase()
  const baseName = path.basename(filePath, ext)
  const targetName = `${baseName}.md`

  const buffer = fs.readFileSync(filePath)
  let content = ''

  switch (ext) {
    case '.docx':
      content = await importDocxBuffer(buffer)
      break
    case '.html':
    case '.htm':
      content = importHtmlBuffer(buffer)
      break
    case '.pdf':
      content = await importPdfBuffer(buffer)
      break
    case '.txt':
      content = importTxtBuffer(buffer)
      break
    case '.md':
    case '.markdown':
      content = buffer.toString('utf-8')
      break
    default:
      // Попытка прочитать как текст
      content = buffer.toString('utf-8')
      break
  }

  return {
    fileName: targetName,
    content,
  }
}
