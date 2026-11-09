import fs from 'node:fs'
import path from 'node:path'

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
    return /^(\s*[-*+•]\s+|\s*\d+[.)]\s+|#{1,6}\s+)/.test(line)
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
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .join('\n\n')
}

/**
 * Импорт PDF-файла из буфера
 */
export async function importPdfBuffer(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PDFParse } = require('pdf-parse')
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
 * Импорт DOCX-файла из буфера с извлечением картинок в base64
 */
export async function importDocxBuffer(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mammoth = require('mammoth')
    const options = {
      convertImage: mammoth.images.imgElement(async (element: any) => {
        const base64 = await element.read('base64')
        return {
          src: `data:${element.contentType};base64,${base64}`,
        }
      }),
    }
    const result = await mammoth.convertToMarkdown({ buffer }, options)
    return (result.value || '').trim()
  } catch (err) {
    console.error('Ошибка импорта DOCX:', err)
    throw new Error(`Не удалось сконвертировать Word-документ (.docx): ${err instanceof Error ? err.message : String(err)}`)
  }
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
