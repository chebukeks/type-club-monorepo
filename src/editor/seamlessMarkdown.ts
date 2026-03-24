/**
 * seamlessMarkdown.ts — Расширение CodeMirror 6 для «seamless» режима
 *
 * Поддерживаемые конструкции:
 * ─ Заголовки H1–H6
 * ─ Жирный (**), курсив (*), жирный курсив (***)
 * ─ Зачёркнутый (~~strikethrough~~)
 * ─ Выделение (==highlight==)
 * ─ Инлайн-код (`code`)
 * ─ Ссылки [text](url)
 * ─ Блоки кода ``` ... ```
 * ─ Таблицы (построчная стилизация без виджетов)
 * ─ Цитаты (> blockquote)
 * ─ Списки (-, *, 1.)
 * ─ Чекбоксы (- [ ] / - [x])
 * ─ Горизонтальная линия (---, ***, ___)
 *
 * ВАЖНО: Таблицы стилизуются построчно через Decoration.line() и Decoration.mark().
 * Мультистрочный Decoration.replace() НЕ используется — он ломает курсор в CM6.
 */
import {
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view'
import type { Range } from '@codemirror/state'

// ============================================================
// Виджеты (только для однострочных замен)
// ============================================================

/** Горизонтальная линия */
class HrWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement('hr')
    hr.className = 'cm-md-hr-widget'
    return hr
  }
}

/** Чекбокс */
class CheckboxWidget extends WidgetType {
  constructor(private checked: boolean) { super() }
  toDOM() {
    const span = document.createElement('span')
    span.className = `cm-md-checkbox ${this.checked ? 'cm-md-checkbox-checked' : ''}`
    span.textContent = this.checked ? '✓' : ' '
    return span
  }
}

// ============================================================
// Утилиты
// ============================================================

const hideDecoration = Decoration.replace({})

function markDeco(cssClass: string) {
  return Decoration.mark({ class: cssClass })
}

// ============================================================
// Регулярные выражения
// ============================================================

const HEADING_RE = /^(#{1,6})\s/
const BOLD_ITALIC_RE = /\*\*\*(.+?)\*\*\*/g
const BOLD_RE = /\*\*(.+?)\*\*/g
const ITALIC_RE = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g
const STRIKETHROUGH_RE = /~~(.+?)~~/g
const HIGHLIGHT_RE = /==(.+?)==/g
const INLINE_CODE_RE = /`([^`]+)`/g
const BLOCKQUOTE_RE = /^>\s/
const UNORDERED_LIST_RE = /^(\s*)([-*])\s/
const ORDERED_LIST_RE = /^(\s*)(\d+\.)\s/
const HR_RE = /^(---|\*\*\*|___)$/
const FENCED_CODE_START_RE = /^```(\w*)$/
const FENCED_CODE_END_RE = /^```$/
const TABLE_ROW_RE = /^\|(.+)\|$/
const TABLE_SEPARATOR_RE = /^\|[\s:]*-{3,}[\s:]*(\|[\s:]*-{3,}[\s:]*)*\|$/
const CHECKBOX_RE = /^(\s*[-*]\s)\[([ xX])\]\s/
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g
const PIPE_RE = /\|/g

// ============================================================
// Основной ViewPlugin
// ============================================================

export const seamlessMarkdownPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view)
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const ranges: Range<Decoration>[] = []
      const doc = view.state.doc

      // Номера строк с курсором
      const cursorLines = new Set<number>()
      for (const range of view.state.selection.ranges) {
        const startLine = doc.lineAt(range.from).number
        const endLine = doc.lineAt(range.to).number
        for (let l = startLine; l <= endLine; l++) {
          cursorLines.add(l)
        }
      }

      let i = 1
      while (i <= doc.lines) {
        const line = doc.line(i)
        const lineText = line.text

        // ==============================================
        // Fenced Code Block
        // ==============================================
        const codeStartMatch = lineText.match(FENCED_CODE_START_RE)
        if (codeStartMatch) {
          const lang = codeStartMatch[1] || ''
          const blockStartLine = i
          let blockEndLine = -1
          for (let j = i + 1; j <= doc.lines; j++) {
            if (FENCED_CODE_END_RE.test(doc.line(j).text)) {
              blockEndLine = j; break
            }
          }

          if (blockEndLine !== -1) {
            let cursorInBlock = false
            for (let l = blockStartLine; l <= blockEndLine; l++) {
              if (cursorLines.has(l)) { cursorInBlock = true; break }
            }

            const startLineObj = doc.line(blockStartLine)
            if (cursorInBlock) {
              ranges.push(markDeco('cm-md-codeFence').range(startLineObj.from, startLineObj.to))
            } else if (lang) {
              ranges.push(markDeco('cm-md-codeLang').range(startLineObj.from, startLineObj.to))
              ranges.push(hideDecoration.range(startLineObj.from, startLineObj.from + 3))
            } else {
              if (startLineObj.to > startLineObj.from) {
                ranges.push(hideDecoration.range(startLineObj.from, startLineObj.to))
              }
            }

            for (let l = blockStartLine + 1; l < blockEndLine; l++) {
              const codeLine = doc.line(l)
              if (codeLine.text.length > 0) {
                ranges.push(markDeco('cm-md-codeContent').range(codeLine.from, codeLine.to))
              }
            }

            const endLineObj = doc.line(blockEndLine)
            if (cursorInBlock) {
              ranges.push(markDeco('cm-md-codeFence').range(endLineObj.from, endLineObj.to))
            } else if (endLineObj.to > endLineObj.from) {
              ranges.push(hideDecoration.range(endLineObj.from, endLineObj.to))
            }

            for (let l = blockStartLine; l <= blockEndLine; l++) {
              ranges.push(
                Decoration.line({ class: 'cm-md-codeBlockLine' }).range(doc.line(l).from)
              )
            }

            i = blockEndLine + 1
            continue
          }
        }

        // Пустая строка
        if (lineText.trim() === '') { i++; continue }

        // ==============================================
        // Горизонтальная линия (НЕ внутри таблицы)
        // ==============================================
        if (HR_RE.test(lineText)) {
          // Проверяем: не является ли это разделителем таблицы
          // (если соседние строки — строки таблицы)
          const prevIsTable = i > 1 && TABLE_ROW_RE.test(doc.line(i - 1).text)
          const nextIsTable = i < doc.lines && TABLE_ROW_RE.test(doc.line(i + 1).text)

          if (!prevIsTable && !nextIsTable) {
            const isActiveLine = cursorLines.has(i)
            if (!isActiveLine) {
              ranges.push(
                Decoration.replace({ widget: new HrWidget() }).range(line.from, line.to)
              )
            } else {
              ranges.push(markDeco('cm-md-hr').range(line.from, line.to))
            }
            i++; continue
          }
        }

        // ==============================================
        // Таблица — построчная стилизация (БЕЗ виджетов)
        // ==============================================
        if (TABLE_ROW_RE.test(lineText)) {
          const tableStartLine = i
          let tableEnd = i
          while (tableEnd + 1 <= doc.lines && TABLE_ROW_RE.test(doc.line(tableEnd + 1).text)) {
            tableEnd++
          }

          for (let l = tableStartLine; l <= tableEnd; l++) {
            const tableLine = doc.line(l)
            const text = tableLine.text
            const isSep = TABLE_SEPARATOR_RE.test(text)
            const isHeader = l === tableStartLine
            const isActive = cursorLines.has(l)

            // ------ Линейная декорация (фон строки) ------
            if (isSep) {
              ranges.push(Decoration.line({ class: 'cm-md-tableSepLine' }).range(tableLine.from))
            } else if (isHeader) {
              ranges.push(Decoration.line({ class: 'cm-md-tableHeaderLine' }).range(tableLine.from))
            } else {
              ranges.push(Decoration.line({ class: 'cm-md-tableRowLine' }).range(tableLine.from))
            }

            // ------ Стилизация содержимого ------
            if (isSep) {
              // Разделитель: стилизуем целиком как тонкую линию
              ranges.push(markDeco('cm-md-tableSep').range(tableLine.from, tableLine.to))
              if (!isActive) {
                // Скрываем содержимое, показываем только через CSS border
                ranges.push(hideDecoration.range(tableLine.from, tableLine.to))
              }
            } else {
              // Заголовок или строка данных: стилизуем пайпы и ячейки
              const cellClass = isHeader ? 'cm-md-thText' : 'cm-md-tdText'
              ranges.push(markDeco(cellClass).range(tableLine.from, tableLine.to))

              // Стилизуем | как разделители
              const pipeRe = new RegExp(PIPE_RE.source, 'g')
              let pm: RegExpExecArray | null
              while ((pm = pipeRe.exec(text)) !== null) {
                const pipePos = tableLine.from + pm.index
                ranges.push(markDeco('cm-md-tablePipe').range(pipePos, pipePos + 1))
              }

              // Инлайн-форматирование внутри ячеек
              this.addInlineDecorations(ranges, tableLine.from, text, isActive)
            }
          }

          i = tableEnd + 1
          continue
        }

        const isActiveLine = cursorLines.has(i)

        // ==============================================
        // Заголовки
        // ==============================================
        const headingMatch = lineText.match(HEADING_RE)
        if (headingMatch) {
          const level = headingMatch[1].length
          const markerLen = level + 1
          const headerClass = `cm-md-header${Math.min(level, 6)}`
          ranges.push(markDeco(headerClass).range(line.from, line.to))
          if (!isActiveLine) {
            ranges.push(hideDecoration.range(line.from, line.from + markerLen))
          }
          this.addInlineDecorations(ranges, line.from, lineText, isActiveLine)
          i++; continue
        }

        // ==============================================
        // Цитата
        // ==============================================
        if (BLOCKQUOTE_RE.test(lineText)) {
          ranges.push(markDeco('cm-md-blockquote').range(line.from, line.to))
          ranges.push(Decoration.line({ class: 'cm-md-blockquoteLine' }).range(line.from))
          if (!isActiveLine) {
            ranges.push(hideDecoration.range(line.from, line.from + 2))
          }
          this.addInlineDecorations(ranges, line.from, lineText, isActiveLine)
          i++; continue
        }

        // ==============================================
        // Чекбоксы
        // ==============================================
        const checkboxMatch = lineText.match(CHECKBOX_RE)
        if (checkboxMatch) {
          const prefixLen = checkboxMatch[1].length
          const isChecked = checkboxMatch[2].toLowerCase() === 'x'
          ranges.push(
            markDeco(isChecked ? 'cm-md-checkboxDone' : 'cm-md-checkboxTodo')
              .range(line.from, line.to)
          )
          if (!isActiveLine) {
            const checkboxStart = line.from + prefixLen
            const checkboxEnd = checkboxStart + 4
            ranges.push(hideDecoration.range(line.from, line.from + prefixLen))
            ranges.push(
              Decoration.replace({ widget: new CheckboxWidget(isChecked) })
                .range(checkboxStart, checkboxEnd)
            )
          }
          this.addInlineDecorations(ranges, line.from, lineText, isActiveLine)
          i++; continue
        }

        // ==============================================
        // Маркированный список
        // ==============================================
        const ulMatch = lineText.match(UNORDERED_LIST_RE)
        if (ulMatch) {
          const indent = ulMatch[1].length
          ranges.push(
            markDeco('cm-md-listMarker').range(line.from + indent, line.from + indent + 1)
          )
          this.addInlineDecorations(ranges, line.from, lineText, isActiveLine)
          i++; continue
        }

        // ==============================================
        // Нумерованный список
        // ==============================================
        const olMatch = lineText.match(ORDERED_LIST_RE)
        if (olMatch) {
          const indent = olMatch[1].length
          const numLen = olMatch[2].length
          ranges.push(
            markDeco('cm-md-listMarker').range(line.from + indent, line.from + indent + numLen)
          )
          this.addInlineDecorations(ranges, line.from, lineText, isActiveLine)
          i++; continue
        }

        // ==============================================
        // Обычная строка
        // ==============================================
        this.addInlineDecorations(ranges, line.from, lineText, isActiveLine)
        i++
      }

      return Decoration.set(ranges, true)
    }

    // ============================================================
    // Инлайн-декорации
    // ============================================================

    addInlineDecorations(
      ranges: Range<Decoration>[],
      lineFrom: number,
      text: string,
      isActiveLine: boolean
    ) {
      const processed: Array<[number, number]> = []
      let match: RegExpExecArray | null

      // --- Инлайн-код (ПЕРВЫМ) ---
      const codeRe = new RegExp(INLINE_CODE_RE.source, 'g')
      while ((match = codeRe.exec(text)) !== null) {
        const ms = match.index, me = ms + match[0].length
        const start = lineFrom + ms, end = lineFrom + me
        ranges.push(markDeco('cm-md-inlineCode').range(start, end))
        if (!isActiveLine) {
          ranges.push(hideDecoration.range(start, start + 1))
          ranges.push(hideDecoration.range(end - 1, end))
        }
        processed.push([ms, me])
      }

      // --- Жирный курсив: ***text*** ---
      const biRe = new RegExp(BOLD_ITALIC_RE.source, 'g')
      while ((match = biRe.exec(text)) !== null) {
        const ms = match.index, me = ms + match[0].length
        if (this.overlaps(processed, ms, me)) continue
        const start = lineFrom + ms, end = lineFrom + me
        ranges.push(markDeco('cm-md-boldItalic').range(start + 3, end - 3))
        if (!isActiveLine) {
          ranges.push(hideDecoration.range(start, start + 3))
          ranges.push(hideDecoration.range(end - 3, end))
        }
        processed.push([ms, me])
      }

      // --- Жирный: **text** ---
      const boldRe = new RegExp(BOLD_RE.source, 'g')
      while ((match = boldRe.exec(text)) !== null) {
        const ms = match.index, me = ms + match[0].length
        if (this.overlaps(processed, ms, me)) continue
        const start = lineFrom + ms, end = lineFrom + me
        ranges.push(markDeco('cm-md-bold').range(start + 2, end - 2))
        if (!isActiveLine) {
          ranges.push(hideDecoration.range(start, start + 2))
          ranges.push(hideDecoration.range(end - 2, end))
        }
        processed.push([ms, me])
      }

      // --- Зачёркнутый: ~~text~~ ---
      const strikeRe = new RegExp(STRIKETHROUGH_RE.source, 'g')
      while ((match = strikeRe.exec(text)) !== null) {
        const ms = match.index, me = ms + match[0].length
        if (this.overlaps(processed, ms, me)) continue
        const start = lineFrom + ms, end = lineFrom + me
        ranges.push(markDeco('cm-md-strikethrough').range(start + 2, end - 2))
        if (!isActiveLine) {
          ranges.push(hideDecoration.range(start, start + 2))
          ranges.push(hideDecoration.range(end - 2, end))
        }
        processed.push([ms, me])
      }

      // --- Выделение: ==text== ---
      const hlRe = new RegExp(HIGHLIGHT_RE.source, 'g')
      while ((match = hlRe.exec(text)) !== null) {
        const ms = match.index, me = ms + match[0].length
        if (this.overlaps(processed, ms, me)) continue
        const start = lineFrom + ms, end = lineFrom + me
        ranges.push(markDeco('cm-md-highlight').range(start + 2, end - 2))
        if (!isActiveLine) {
          ranges.push(hideDecoration.range(start, start + 2))
          ranges.push(hideDecoration.range(end - 2, end))
        }
        processed.push([ms, me])
      }

      // --- Курсив: *text* ---
      const italicRe = new RegExp(ITALIC_RE.source, 'g')
      while ((match = italicRe.exec(text)) !== null) {
        const ms = match.index, me = ms + match[0].length
        if (this.overlaps(processed, ms, me)) continue
        const start = lineFrom + ms, end = lineFrom + me
        ranges.push(markDeco('cm-md-italic').range(start + 1, end - 1))
        if (!isActiveLine) {
          ranges.push(hideDecoration.range(start, start + 1))
          ranges.push(hideDecoration.range(end - 1, end))
        }
        processed.push([ms, me])
      }

      // --- Ссылки: [text](url) ---
      const linkRe = new RegExp(LINK_RE.source, 'g')
      while ((match = linkRe.exec(text)) !== null) {
        const ms = match.index, me = ms + match[0].length
        if (this.overlaps(processed, ms, me)) continue
        const start = lineFrom + ms, end = lineFrom + me
        const linkTextLen = match[1].length
        ranges.push(markDeco('cm-md-link').range(start + 1, start + 1 + linkTextLen))
        if (!isActiveLine) {
          ranges.push(hideDecoration.range(start, start + 1))
          ranges.push(hideDecoration.range(start + 1 + linkTextLen, end))
        }
        processed.push([ms, me])
      }
    }

    /** Проверка пересечения */
    overlaps(processed: Array<[number, number]>, start: number, end: number): boolean {
      return processed.some(([ps, pe]) =>
        (start >= ps && start < pe) || (end > ps && end <= pe) || (start <= ps && end >= pe)
      )
    }
  },
  {
    decorations: (v) => v.decorations,
  }
)
