/**
 * seamlessMarkdown.ts — Расширение CodeMirror 6 для «seamless» режима
 *
 * Поддерживаемые конструкции:
 * - Заголовки: # H1 — ###### H6
 * - Жирный: **bold**
 * - Курсив: *italic*
 * - Инлайн-код: `code`
 * - Блоки кода: ```lang ... ```  (fenced code blocks)
 * - Цитаты: > blockquote
 * - Маркированные списки: - item, * item
 * - Нумерованные списки: 1. item
 * - Чекбоксы: - [ ] todo, - [x] done
 * - Таблицы: | col | col |
 * - Горизонтальная линия: --- / *** / ___
 * - Ссылки: [text](url)
 *
 * Логика seamless:
 * Если курсор находится на строке — спецсимволы видны.
 * Если курсор вне строки — спецсимволы скрыты, текст стилизован.
 *
 * ВАЖНО: Используем Decoration.set(ranges, true) для автосортировки.
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
// Виджеты (для замены спецсимволов на визуальные элементы)
// ============================================================

/** Виджет горизонтальной линии — заменяет --- на <hr> */
class HrWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement('hr')
    hr.className = 'cm-md-hr-widget'
    return hr
  }
}

/** Виджет чекбокса */
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
// Вспомогательные функции
// ============================================================

/** Декорация: заменить диапазон на ничто (скрыть символы) */
const hideDecoration = Decoration.replace({})

/** Создать CSS-класс декорацию */
function markDeco(cssClass: string) {
  return Decoration.mark({ class: cssClass })
}

// ============================================================
// Регулярные выражения
// ============================================================

const HEADING_RE = /^(#{1,6})\s/
const BOLD_RE = /\*\*(.+?)\*\*/g
const ITALIC_RE = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g
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

      // Номера строк, на которых стоит курсор
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
        const isActiveLine = cursorLines.has(i)

        // ==============================================
        // Fenced Code Block: ``` ... ```
        // ==============================================
        const codeStartMatch = lineText.match(FENCED_CODE_START_RE)
        if (codeStartMatch) {
          const lang = codeStartMatch[1] || ''
          const blockStartLine = i

          // Ищем закрывающий ```
          let blockEndLine = -1
          for (let j = i + 1; j <= doc.lines; j++) {
            if (FENCED_CODE_END_RE.test(doc.line(j).text)) {
              blockEndLine = j
              break
            }
          }

          if (blockEndLine !== -1) {
            // Проверяем, находится ли курсор внутри блока кода
            let cursorInBlock = false
            for (let l = blockStartLine; l <= blockEndLine; l++) {
              if (cursorLines.has(l)) { cursorInBlock = true; break }
            }

            // Стилизация открывающего ``` (первая строка)
            const startLineObj = doc.line(blockStartLine)
            if (cursorInBlock) {
              // Курсор внутри — показываем ```, стилизуем как мету
              ranges.push(markDeco('cm-md-codeFence').range(startLineObj.from, startLineObj.to))
            } else {
              // Курсор вне — скрываем ``` строку
              if (lang) {
                // Показываем бейдж с языком, заменяя ``` на метку
                ranges.push(markDeco('cm-md-codeLang').range(startLineObj.from, startLineObj.to))
                ranges.push(hideDecoration.range(startLineObj.from, startLineObj.from + 3))
              } else {
                ranges.push(hideDecoration.range(startLineObj.from, startLineObj.to))
              }
            }

            // Стилизация содержимого блока кода
            for (let l = blockStartLine + 1; l < blockEndLine; l++) {
              const codeLine = doc.line(l)
              if (codeLine.text.length > 0) {
                ranges.push(markDeco('cm-md-codeContent').range(codeLine.from, codeLine.to))
              }
            }

            // Стилизация/скрытие закрывающего ```
            const endLineObj = doc.line(blockEndLine)
            if (cursorInBlock) {
              ranges.push(markDeco('cm-md-codeFence').range(endLineObj.from, endLineObj.to))
            } else {
              ranges.push(hideDecoration.range(endLineObj.from, endLineObj.to))
            }

            // Линия-декорация для всего блока (фон)
            for (let l = blockStartLine; l <= blockEndLine; l++) {
              ranges.push(
                Decoration.line({ class: 'cm-md-codeBlockLine' }).range(doc.line(l).from)
              )
            }

            i = blockEndLine + 1
            continue
          }
        }

        // Пустая строка — пропускаем
        if (lineText.trim() === '') { i++; continue }

        // ==============================================
        // Горизонтальная линия: --- / *** / ___
        // ==============================================
        if (HR_RE.test(lineText)) {
          if (!isActiveLine) {
            // Заменяем текст на виджет <hr>
            ranges.push(
              Decoration.replace({ widget: new HrWidget() }).range(line.from, line.to)
            )
          } else {
            ranges.push(markDeco('cm-md-hr').range(line.from, line.to))
          }
          i++; continue
        }

        // ==============================================
        // Таблица: | col | col |
        // ==============================================
        if (TABLE_ROW_RE.test(lineText)) {
          // Определяем блок таблицы (несколько строк подряд с |)
          const tableStart = i
          let tableEnd = i
          while (tableEnd + 1 <= doc.lines && TABLE_ROW_RE.test(doc.line(tableEnd + 1).text)) {
            tableEnd++
          }

          // Проверяем, стоит ли курсор в таблице
          let cursorInTable = false
          for (let l = tableStart; l <= tableEnd; l++) {
            if (cursorLines.has(l)) { cursorInTable = true; break }
          }

          for (let l = tableStart; l <= tableEnd; l++) {
            const tableLine = doc.line(l)
            const tableLineText = tableLine.text

            // Линия-разделитель (|---|---|)
            if (TABLE_SEPARATOR_RE.test(tableLineText)) {
              if (!cursorInTable) {
                // Скрываем разделитель, показываем тонкую линию
                ranges.push(
                  Decoration.replace({ widget: new HrWidget() }).range(tableLine.from, tableLine.to)
                )
              } else {
                ranges.push(markDeco('cm-md-tableSeparator').range(tableLine.from, tableLine.to))
              }
              continue
            }

            // Заголовок таблицы (первая строка) или строка данных
            const isHeader = l === tableStart
            const cellClass = isHeader ? 'cm-md-tableHeader' : 'cm-md-tableCell'
            ranges.push(markDeco(cellClass).range(tableLine.from, tableLine.to))

            // Декорация для строки таблицы (добавляет фон)
            ranges.push(
              Decoration.line({ class: 'cm-md-tableLine' }).range(tableLine.from)
            )
          }

          i = tableEnd + 1
          continue
        }

        // ==============================================
        // Заголовки: # — ######
        // ==============================================
        const headingMatch = lineText.match(HEADING_RE)
        if (headingMatch) {
          const level = headingMatch[1].length
          const markerLen = level + 1

          const headerClass =
            level === 1 ? 'cm-md-header1' :
            level === 2 ? 'cm-md-header2' :
            level === 3 ? 'cm-md-header3' :
            level === 4 ? 'cm-md-header4' :
            level === 5 ? 'cm-md-header5' :
                          'cm-md-header6'

          ranges.push(markDeco(headerClass).range(line.from, line.to))

          if (!isActiveLine) {
            ranges.push(hideDecoration.range(line.from, line.from + markerLen))
          }

          this.addInlineDecorations(ranges, line.from, lineText, isActiveLine)
          i++; continue
        }

        // ==============================================
        // Цитата (blockquote): > text
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
        // Чекбоксы: - [ ] / - [x]
        // ==============================================
        const checkboxMatch = lineText.match(CHECKBOX_RE)
        if (checkboxMatch) {
          const prefixLen = checkboxMatch[1].length // "- " или "* "
          const isChecked = checkboxMatch[2].toLowerCase() === 'x'

          // Стилизация строки
          ranges.push(
            markDeco(isChecked ? 'cm-md-checkboxDone' : 'cm-md-checkboxTodo')
              .range(line.from, line.to)
          )

          if (!isActiveLine) {
            // Скрываем "- " и "[x] " / "[ ] ", заменяем на виджет чекбокса
            const checkboxStart = line.from + prefixLen // позиция [
            const checkboxEnd = checkboxStart + 4       // позиция после "] "

            // Скрываем префикс "- " (маркер списка)
            ranges.push(hideDecoration.range(line.from, line.from + prefixLen))
            // Заменяем [x] на виджет
            ranges.push(
              Decoration.replace({ widget: new CheckboxWidget(isChecked) })
                .range(checkboxStart, checkboxEnd)
            )
          }

          this.addInlineDecorations(ranges, line.from, lineText, isActiveLine)
          i++; continue
        }

        // ==============================================
        // Маркированный список: - item / * item
        // ==============================================
        const ulMatch = lineText.match(UNORDERED_LIST_RE)
        if (ulMatch) {
          const indent = ulMatch[1].length
          ranges.push(
            markDeco('cm-md-listMarker').range(
              line.from + indent,
              line.from + indent + 1
            )
          )
          this.addInlineDecorations(ranges, line.from, lineText, isActiveLine)
          i++; continue
        }

        // ==============================================
        // Нумерованный список: 1. item
        // ==============================================
        const olMatch = lineText.match(ORDERED_LIST_RE)
        if (olMatch) {
          const indent = olMatch[1].length
          const numLen = olMatch[2].length
          ranges.push(
            markDeco('cm-md-listMarker').range(
              line.from + indent,
              line.from + indent + numLen
            )
          )
          this.addInlineDecorations(ranges, line.from, lineText, isActiveLine)
          i++; continue
        }

        // ==============================================
        // Обычная строка — обрабатываем только инлайн
        // ==============================================
        this.addInlineDecorations(ranges, line.from, lineText, isActiveLine)
        i++
      }

      return Decoration.set(ranges, true)
    }

    /**
     * Инлайн-декорации: **bold**, *italic*, `code`, [link](url).
     */
    addInlineDecorations(
      ranges: Range<Decoration>[],
      lineFrom: number,
      text: string,
      isActiveLine: boolean
    ) {
      const processed: Array<[number, number]> = []

      // --- Инлайн-код: `code` (обрабатываем ПЕРВЫМ, чтобы внутри не парсить) ---
      let match: RegExpExecArray | null
      const codeRe = new RegExp(INLINE_CODE_RE.source, 'g')
      while ((match = codeRe.exec(text)) !== null) {
        const matchStart = match.index
        const matchEnd = matchStart + match[0].length
        const start = lineFrom + matchStart
        const end = lineFrom + matchEnd

        ranges.push(markDeco('cm-md-inlineCode').range(start, end))

        if (!isActiveLine) {
          ranges.push(hideDecoration.range(start, start + 1))
          ranges.push(hideDecoration.range(end - 1, end))
        }

        processed.push([matchStart, matchEnd])
      }

      // --- Жирный: **text** ---
      const boldRe = new RegExp(BOLD_RE.source, 'g')
      while ((match = boldRe.exec(text)) !== null) {
        const matchStart = match.index
        const matchEnd = matchStart + match[0].length

        if (this.overlaps(processed, matchStart, matchEnd)) continue

        const start = lineFrom + matchStart
        const end = lineFrom + matchEnd

        ranges.push(markDeco('cm-md-bold').range(start + 2, end - 2))

        if (!isActiveLine) {
          ranges.push(hideDecoration.range(start, start + 2))
          ranges.push(hideDecoration.range(end - 2, end))
        }

        processed.push([matchStart, matchEnd])
      }

      // --- Курсив: *text* ---
      const italicRe = new RegExp(ITALIC_RE.source, 'g')
      while ((match = italicRe.exec(text)) !== null) {
        const matchStart = match.index
        const matchEnd = matchStart + match[0].length

        if (this.overlaps(processed, matchStart, matchEnd)) continue

        const start = lineFrom + matchStart
        const end = lineFrom + matchEnd

        ranges.push(markDeco('cm-md-italic').range(start + 1, end - 1))

        if (!isActiveLine) {
          ranges.push(hideDecoration.range(start, start + 1))
          ranges.push(hideDecoration.range(end - 1, end))
        }

        processed.push([matchStart, matchEnd])
      }

      // --- Ссылки: [text](url) ---
      const linkRe = new RegExp(LINK_RE.source, 'g')
      while ((match = linkRe.exec(text)) !== null) {
        const matchStart = match.index
        const matchEnd = matchStart + match[0].length

        if (this.overlaps(processed, matchStart, matchEnd)) continue

        const start = lineFrom + matchStart
        const end = lineFrom + matchEnd
        const linkTextLen = match[1].length

        // Стилизуем текст ссылки
        ranges.push(markDeco('cm-md-link').range(start + 1, start + 1 + linkTextLen))

        if (!isActiveLine) {
          // Скрываем [ и ](url)
          ranges.push(hideDecoration.range(start, start + 1))                          // [
          ranges.push(hideDecoration.range(start + 1 + linkTextLen, end))               // ](url)
        }

        processed.push([matchStart, matchEnd])
      }
    }

    /** Проверка пересечения с уже обработанными диапазонами */
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
