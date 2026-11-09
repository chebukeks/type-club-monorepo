import MarkdownIt from 'markdown-it'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageNumber,
  Footer,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  } from 'docx'

export interface DocxExportOptions {
  preset?: 'standard' | 'gost'
  title?: string
}

interface InlineStyle {
  bold?: boolean
  italic?: boolean
  strike?: boolean
  code?: boolean
}

/**
 * Преобразует Markdown-документ в бинарный буфер .docx (Word)
 */
export async function markdownToDocxBuffer(
  markdown: string,
  options: DocxExportOptions = {}
): Promise<Buffer> {
  const preset = options.preset || 'standard'
  const isGost = preset === 'gost'

  // Настройки шрифтов и геометрии
  const bodyFont = isGost ? 'Times New Roman' : 'Calibri'
  const bodySize = isGost ? 28 : 22 // в half-points: 28 = 14pt, 22 = 11pt
  const bodyLineSpacing = isGost ? 360 : 276 // 360 = 1.5, 276 = 1.15
  const bodyAlignment = isGost ? AlignmentType.JUSTIFIED : AlignmentType.LEFT
  const firstLineIndent = isGost ? 709 : undefined // 1.25 см = 709 twips

  // Поля страницы
  const pageMargins = isGost
    ? {
        left: 1701, // 30 мм
        right: 567, // 10 мм
        top: 1134, // 20 мм
        bottom: 1134, // 20 мм
      }
    : {
        left: 1440, // 25.4 мм (1 дюйм)
        right: 1440,
        top: 1440,
        bottom: 1440,
      }

  const md = new MarkdownIt({
    html: false,
    breaks: true,
    linkify: true,
  })

  // Очищаем специфичные расширения и фронтматтер перед парсингом
  const cleanedMarkdown = markdown
    .replace(/^---[\s\S]*?---\r?\n*/, '')
    .replace(/^\+\+\+[\s\S]*?\+\+\+\r?\n*/, '')
    .replace(/<span[^>]*class="[^"]*suggestion-delete[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')
    .replace(/<span[^>]*class="[^"]*suggestion-insert[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1')
    .replace(/<span[^>]*class="[^"]*suggestion-note[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')

  const tokens = md.parse(cleanedMarkdown, {})
  const docElements: (Paragraph | Table)[] = []

  let inList = false
  let listType: 'bullet' | 'ordered' = 'bullet'
  let listIndex = 0

  let inTable = false
  let tableRows: TableRow[] = []
  let currentRowCells: TableCell[] = []
  let isHeaderRow = false

  let inBlockquote = false

  // Преобразование токенов inline в TextRun[]
  const parseInlineChildren = (inlineTokens: any[], baseStyle: InlineStyle = {}): TextRun[] => {
    const runs: TextRun[] = []
    const styleStack: InlineStyle[] = [{ ...baseStyle }]

    const currentStyle = () => styleStack[styleStack.length - 1]

    for (let i = 0; i < inlineTokens.length; i++) {
      const token = inlineTokens[i]

      switch (token.type) {
        case 'strong_open':
          styleStack.push({ ...currentStyle(), bold: true })
          break
        case 'strong_close':
          styleStack.pop()
          break
        case 'em_open':
          styleStack.push({ ...currentStyle(), italic: true })
          break
        case 'em_close':
          styleStack.pop()
          break
        case 's_open':
          styleStack.push({ ...currentStyle(), strike: true })
          break
        case 's_close':
          styleStack.pop()
          break
        case 'code_inline': {
          runs.push(
            new TextRun({
              text: token.content,
              font: 'Consolas',
              size: isGost ? 24 : 20,
              shading: isGost ? undefined : { fill: 'F3F4F6' },
            })
          )
          break
        }
        case 'text':
        case 'link_open':
        case 'link_close': {
          if (token.type === 'text' && token.content) {
            const st = currentStyle()
            runs.push(
              new TextRun({
                text: token.content,
                font: bodyFont,
                size: bodySize,
                bold: st.bold,
                italics: st.italic,
                strike: st.strike,
                color: isGost ? '000000' : undefined,
              })
            )
          }
          break
        }
        default:
          if (token.content) {
            runs.push(
              new TextRun({
                text: token.content,
                font: bodyFont,
                size: bodySize,
                color: isGost ? '000000' : undefined,
              })
            )
          }
          break
      }
    }

    return runs
  }

  // Обход токенов markdown-it
  for (let idx = 0; idx < tokens.length; idx++) {
    const token = tokens[idx]

    switch (token.type) {
      // 1. Заголовки (h1 - h6)
      case 'heading_open': {
        const levelNum = parseInt(token.tag.replace('h', ''), 10) || 1
        const nextToken = tokens[idx + 1]
        const inlineContent = nextToken && nextToken.type === 'inline' ? nextToken.content : ''
        idx++ // пропускаем inline
        idx++ // пропускаем heading_close

        let headingText = inlineContent
        if (isGost && headingText.endsWith('.')) {
          headingText = headingText.slice(0, -1) // по ГОСТ точка в конце заголовка не ставится
        }

        let headingLevel: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1
        if (levelNum === 2) headingLevel = HeadingLevel.HEADING_2
        if (levelNum === 3) headingLevel = HeadingLevel.HEADING_3
        if (levelNum === 4) headingLevel = HeadingLevel.HEADING_4
        if (levelNum === 5) headingLevel = HeadingLevel.HEADING_5
        if (levelNum === 6) headingLevel = HeadingLevel.HEADING_6

        docElements.push(
          new Paragraph({
            heading: headingLevel,
            alignment: isGost && levelNum === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
            indent: isGost && levelNum > 1 ? { firstLine: 709 } : undefined,
            spacing: {
              before: isGost ? (levelNum === 1 ? 360 : 240) : 240,
              after: isGost ? (levelNum === 1 ? 240 : 180) : 120,
              line: bodyLineSpacing,
                          },
            children: [
              new TextRun({
                text: headingText,
                font: bodyFont,
                bold: true,
                size: isGost
                  ? (levelNum === 1 ? 32 : 28)
                  : (levelNum === 1 ? 36 : levelNum === 2 ? 28 : 24),
                color: isGost ? '000000' : levelNum === 1 ? '1F4E79' : levelNum === 2 ? '2F5597' : '333333',
              }),
            ],
          })
        )
        break
      }

      // 2. Блоки кода (```lang\n...\n```)
      case 'fence':
      case 'code_block': {
        const codeLines = token.content.split('\n')
        for (const cLine of codeLines) {
          docElements.push(
            new Paragraph({
              spacing: { before: 0, after: 0, line: 240 },
              shading: isGost ? undefined : { fill: 'F4F5F7' },
              border: isGost
                ? undefined
                : {
                    left: { style: BorderStyle.SINGLE, size: 12, color: 'D0D5DD' },
                  },
              children: [
                new TextRun({
                  text: cLine || ' ',
                  font: 'Consolas',
                  size: isGost ? 22 : 19,
                }),
              ],
            })
          )
        }
        break
      }

      // 3. Списки
      case 'bullet_list_open':
        inList = true
        listType = 'bullet'
        break
      case 'bullet_list_close':
        inList = false
        break
      case 'ordered_list_open':
        inList = true
        listType = 'ordered'
        listIndex = 1
        break
      case 'ordered_list_close':
        inList = false
        break

      // 4. Цитаты
      case 'blockquote_open':
        inBlockquote = true
        break
      case 'blockquote_close':
        inBlockquote = false
        break

      // 5. Абзацы
      case 'paragraph_open': {
        const nextToken = tokens[idx + 1]
        if (nextToken && nextToken.type === 'inline') {
          const children = parseInlineChildren(nextToken.children || [], {
            italic: inBlockquote,
          })
          idx++ // пропускаем inline
          idx++ // пропускаем paragraph_close

          if (inList) {
            const prefix = listType === 'bullet' ? '• ' : `${listIndex++}. `
            docElements.push(
              new Paragraph({
                spacing: { before: 60, after: 60, line: bodyLineSpacing },
                indent: { left: 709 },
                alignment: bodyAlignment,
                children: [
                  new TextRun({
                    text: prefix,
                    font: bodyFont,
                    size: bodySize,
                    bold: true,
                    color: isGost ? '000000' : undefined,
                  }),
                  ...children,
                ],
              })
            )
          } else if (inTable) {
            // Внутри ячейки таблицы
            currentRowCells.push(
              new TableCell({
                children: [
                  new Paragraph({
                    alignment: isHeaderRow ? AlignmentType.CENTER : AlignmentType.LEFT,
                    spacing: { before: 60, after: 60 },
                    children,
                  }),
                ],
              })
            )
          } else if (inBlockquote) {
            docElements.push(
              new Paragraph({
                spacing: { before: 120, after: 120, line: bodyLineSpacing },
                indent: { left: 709 },
                border: {
                  left: { style: BorderStyle.SINGLE, size: 24, color: isGost ? '000000' : '4F81BD' },
                },
                children,
              })
            )
          } else {
            // Обычный абзац текста
            docElements.push(
              new Paragraph({
                alignment: bodyAlignment,
                indent: firstLineIndent ? { firstLine: firstLineIndent } : undefined,
                spacing: {
                  before: isGost ? 0 : 80,
                  after: isGost ? 0 : 80,
                  line: bodyLineSpacing,
                                  },
                children,
              })
            )
          }
        }
        break
      }

      // 6. Таблицы
      case 'table_open':
        inTable = true
        tableRows = []
        break
      case 'table_close': {
        inTable = false
        if (tableRows.length > 0) {
          docElements.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: tableRows,
            })
          )
        }
        break
      }
      case 'thead_open':
        isHeaderRow = true
        break
      case 'thead_close':
        isHeaderRow = false
        break
      case 'tr_open':
        currentRowCells = []
        break
      case 'tr_close':
        tableRows.push(
          new TableRow({
            tableHeader: isHeaderRow,
            children: currentRowCells,
          })
        )
        break
      case 'th_open':
      case 'td_open': {
        const nextToken = tokens[idx + 1]
        if (nextToken && nextToken.type === 'inline') {
          const children = parseInlineChildren(nextToken.children || [], { bold: isHeaderRow })
          idx++ // пропускаем inline
          idx++ // пропускаем td_close / th_close
          currentRowCells.push(
            new TableCell({
              shading: isHeaderRow ? (isGost ? undefined : { fill: 'F9FAFB' }) : undefined,
              children: [
                new Paragraph({
                  alignment: isHeaderRow ? AlignmentType.CENTER : AlignmentType.LEFT,
                  children,
                }),
              ],
            })
          )
        }
        break
      }

      // 7. Горизонтальная черта
      case 'hr': {
        docElements.push(
          new Paragraph({
            spacing: { before: 180, after: 180 },
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 6, color: isGost ? '000000' : 'CCCCCC' },
            },
            children: [],
          })
        )
        break
      }

      default:
        break
    }
  }

  // Создаем секцию документа Word
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: pageMargins,
          },
        },
        footers: isGost
          ? {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        children: [PageNumber.CURRENT],
                        font: 'Times New Roman',
                        size: 28, // 14pt
                        color: '000000',
                      }),
                    ],
                  }),
                ],
              }),
            }
          : undefined,
        children: docElements.length > 0 ? docElements : [new Paragraph({ text: '' })],
      },
    ],
  })

  return await Packer.toBuffer(doc)
}
