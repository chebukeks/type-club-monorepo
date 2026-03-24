/**
 * seamlessMarkdown.ts — Расширение CodeMirror 6 для «seamless» режима
 *
 * Основная логика:
 * 1. Парсит каждую строку документа, ищет Markdown-конструкции
 * 2. Создаёт декорации (Decoration.replace) для скрытия спецсимволов
 * 3. Создаёт декорации (Decoration.mark) для визуального оформления текста
 * 4. Если курсор находится на строке — декорации скрытия снимаются (символы видны)
 *
 * ВАЖНО: Используем Decoration.set(ranges, true) вместо RangeSetBuilder,
 * чтобы избежать проблем с порядком добавления декораций.
 */
import {
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet,
  EditorView,
} from '@codemirror/view'
import type { Range } from '@codemirror/state'

// ============================================================
// Вспомогательные функции для создания декораций
// ============================================================

/** Декорация: заменить диапазон на ничто (скрыть символы) */
const hideDecoration = Decoration.replace({})

/** Создать CSS-класс декорацию для оформления текста */
function markDeco(cssClass: string) {
  return Decoration.mark({ class: cssClass })
}

// ============================================================
// Регулярные выражения для парсинга Markdown-конструкций
// ============================================================

/** Заголовки: # H1, ## H2, ### H3 и т.д. */
const HEADING_RE = /^(#{1,6})\s/

/** Жирный текст: **bold** */
const BOLD_RE = /\*\*(.+?)\*\*/g

/** Курсив: *italic* (одиночная звёздочка, не часть **) */
const ITALIC_RE = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g

/** Инлайн-код: `code` */
const INLINE_CODE_RE = /`([^`]+)`/g

/** Цитата: > text */
const BLOCKQUOTE_RE = /^>\s/

/** Маркированный список: - item или * item */
const UNORDERED_LIST_RE = /^(\s*)([-*])\s/

/** Нумерованный список: 1. item */
const ORDERED_LIST_RE = /^(\s*)(\d+\.)\s/

/** Горизонтальная линия: --- или *** или ___ */
const HR_RE = /^(---|\*\*\*|___)$/

// ============================================================
// Основной ViewPlugin
// ============================================================

/**
 * Seamless Markdown ViewPlugin.
 * Обновляет декорации при каждом изменении документа или позиции курсора.
 */
export const seamlessMarkdownPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view)
    }

    update(update: ViewUpdate) {
      // Пересчитываем декорации при любом изменении документа или курсора
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view)
      }
    }

    /**
     * Построение набора декораций для всего документа.
     * Ключевая логика: если курсор стоит на строке — спецсимволы видны,
     * иначе — скрыты, а текст стилизован.
     *
     * Используем массив Range<Decoration> и Decoration.set(..., true)
     * для автоматической сортировки — это решает проблему с порядком.
     */
    buildDecorations(view: EditorView): DecorationSet {
      const ranges: Range<Decoration>[] = []
      const doc = view.state.doc

      // Получаем номера строк, на которых стоит курсор
      const cursorLines = new Set<number>()
      for (const range of view.state.selection.ranges) {
        const startLine = doc.lineAt(range.from).number
        const endLine = doc.lineAt(range.to).number
        for (let l = startLine; l <= endLine; l++) {
          cursorLines.add(l)
        }
      }

      // Проходим по каждой строке документа
      for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i)
        const lineText = line.text
        const isActiveLine = cursorLines.has(i)

        // Пустая строка — пропускаем
        if (lineText.trim() === '') continue

        // --- Горизонтальная линия ---
        if (HR_RE.test(lineText)) {
          if (!isActiveLine) {
            ranges.push(markDeco('cm-md-hr').range(line.from, line.to))
          }
          continue
        }

        // --- Заголовки ---
        const headingMatch = lineText.match(HEADING_RE)
        if (headingMatch) {
          const level = headingMatch[1].length
          const markerLen = level + 1 // символы # + пробел

          // CSS-класс в зависимости от уровня заголовка
          const headerClass =
            level === 1 ? 'cm-md-header1' :
            level === 2 ? 'cm-md-header2' :
                          'cm-md-header3'

          // Стилизация всей строки как заголовок
          ranges.push(markDeco(headerClass).range(line.from, line.to))

          // Скрываем # и пробел (только когда курсор не на строке)
          if (!isActiveLine) {
            ranges.push(hideDecoration.range(line.from, line.from + markerLen))
          }

          // Обрабатываем инлайн-разметку внутри заголовка (напр. **bold** в заголовке)
          this.addInlineDecorations(ranges, line.from, lineText, isActiveLine)
          continue
        }

        // --- Цитата (blockquote) ---
        const blockquoteMatch = lineText.match(BLOCKQUOTE_RE)
        if (blockquoteMatch) {
          ranges.push(markDeco('cm-md-blockquote').range(line.from, line.to))
          if (!isActiveLine) {
            ranges.push(hideDecoration.range(line.from, line.from + 2)) // "> "
          }
        }

        // --- Маркированный список ---
        const ulMatch = lineText.match(UNORDERED_LIST_RE)
        if (ulMatch) {
          const indent = ulMatch[1].length
          ranges.push(
            markDeco('cm-md-listMarker').range(
              line.from + indent,
              line.from + indent + 1
            )
          )
        }

        // --- Нумерованный список ---
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
        }

        // --- Инлайн-разметка ---
        this.addInlineDecorations(ranges, line.from, lineText, isActiveLine)
      }

      // Автоматическая сортировка декораций — ключевое отличие от RangeSetBuilder!
      return Decoration.set(ranges, true)
    }

    /**
     * Добавление декораций для инлайн-разметки: **bold**, *italic*, `code`.
     * Все декорации складываются в массив ranges, сортировка происходит позже.
     */
    addInlineDecorations(
      ranges: Range<Decoration>[],
      lineFrom: number,
      text: string,
      isActiveLine: boolean
    ) {
      // Множество уже обработанных диапазонов (чтобы не было наложений)
      const processed: Array<[number, number]> = []

      // --- Жирный: **text** ---
      let match: RegExpExecArray | null
      const boldRe = new RegExp(BOLD_RE.source, 'g')
      while ((match = boldRe.exec(text)) !== null) {
        const start = lineFrom + match.index
        const end = start + match[0].length

        // Стилизация текста (без **) — всегда видна
        ranges.push(markDeco('cm-md-bold').range(start + 2, end - 2))

        // Скрываем ** с обеих сторон (только когда курсор не на строке)
        if (!isActiveLine) {
          ranges.push(hideDecoration.range(start, start + 2))
          ranges.push(hideDecoration.range(end - 2, end))
        }

        processed.push([match.index, match.index + match[0].length])
      }

      // --- Курсив: *text* (не пересекается с bold) ---
      const italicRe = new RegExp(ITALIC_RE.source, 'g')
      while ((match = italicRe.exec(text)) !== null) {
        const matchStart = match.index
        const matchEnd = matchStart + match[0].length

        // Проверяем, не пересекается ли с уже обработанным bold
        const overlaps = processed.some(
          ([ps, pe]) => matchStart >= ps && matchEnd <= pe
        )
        if (overlaps) continue

        const start = lineFrom + matchStart
        const end = lineFrom + matchEnd

        ranges.push(markDeco('cm-md-italic').range(start + 1, end - 1))

        if (!isActiveLine) {
          ranges.push(hideDecoration.range(start, start + 1))
          ranges.push(hideDecoration.range(end - 1, end))
        }

        processed.push([matchStart, matchEnd])
      }

      // --- Инлайн-код: `code` ---
      const codeRe = new RegExp(INLINE_CODE_RE.source, 'g')
      while ((match = codeRe.exec(text)) !== null) {
        const matchStart = match.index
        const matchEnd = matchStart + match[0].length

        const overlaps = processed.some(
          ([ps, pe]) => matchStart >= ps && matchEnd <= pe
        )
        if (overlaps) continue

        const start = lineFrom + matchStart
        const end = lineFrom + matchEnd

        // Стилизация всего блока (включая бэктики — они тоже стилизованы)
        ranges.push(markDeco('cm-md-inlineCode').range(start, end))

        if (!isActiveLine) {
          ranges.push(hideDecoration.range(start, start + 1))
          ranges.push(hideDecoration.range(end - 1, end))
        }
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
)
