/**
 * inputRules.ts — Правила автоматического форматирования при вводе
 *
 * Блочные правила:
 * - `# ` → heading 1 (## → h2, и т.д.)
 * - `---` → horizontal_rule
 *
 * Инлайн-правила (markdown-стиль):
 * - `**text**` → bold
 * - `*text*` → italic
 * - `` `text` `` → inline code
 */
import {
  inputRules,
  textblockTypeInputRule,
  wrappingInputRule,
  InputRule,
} from 'prosemirror-inputrules'
import { schema } from './schema'
import type { Plugin } from 'prosemirror-state'
import { TextSelection } from 'prosemirror-state'
import { NodeType, MarkType } from 'prosemirror-model'

// ============================================================
// Блочные правила
// ============================================================

function headingRule(nodeType: NodeType, maxLevel: number) {
  return textblockTypeInputRule(
    new RegExp(`^(#{1,${maxLevel}})\\s$`),
    nodeType,
    match => ({ level: match[1].length })
  )
}

function hrRule(hrType: NodeType) {
  return new InputRule(
    /^---$/,
    (state, _match, start, _end) => {
      const $start = state.doc.resolve(start)
      const blockStart = $start.before($start.depth)
      const blockEnd = $start.after($start.depth)

      const tr = state.tr
      const paragraph = state.schema.nodes.paragraph.create()
      tr.replaceWith(blockStart, blockEnd, [hrType.create(), paragraph])
      tr.setSelection(TextSelection.near(tr.doc.resolve(blockStart + 2)))
      return tr
    }
  )
}

function codeBlockRule(nodeType: NodeType) {
  return textblockTypeInputRule(
    /^```([a-zA-Z0-9]*)\s$/,
    nodeType,
    match => ({ params: match[1] })
  )
}

function blockQuoteRule(nodeType: NodeType) {
  return wrappingInputRule(/^\s*>\s$/, nodeType)
}

function bulletListRule(nodeType: NodeType) {
  return wrappingInputRule(/^\s*([-+*])\s$/, nodeType)
}

function orderedListRule(nodeType: NodeType) {
  return wrappingInputRule(
    /^(\d+)\.\s$/,
    nodeType,
    match => ({ order: +match[1] }),
    (match, node) => node.childCount + node.attrs.order === +match[1]
  )
}

// ============================================================
// Инлайн-правила для markdown-синтаксиса
// ============================================================

/**
 * Правило: `**text**` → bold text
 * Срабатывает когда пользователь набирает закрывающий `**`
 */
function markInputRule(
  regexp: RegExp,
  markType: MarkType,
): InputRule {
  return new InputRule(regexp, (state, match, start, end) => {
    const textContent = match[1]

    if (!textContent) return null

    const tr = state.tr
    const mark = markType.create()
    const textNode = state.schema.text(textContent, [mark])

    // Заменяем весь match (включая синтаксис) на текст с маркой
    tr.replaceWith(start, end, textNode)

    // Убираем марку из storedMarks, чтобы следующий ввод был нормальным текстом
    tr.removeStoredMark(markType)

    return tr
  })
}

// ============================================================
// Экспорт
// ============================================================

export function getInputRulesPlugin(): Plugin {
  return inputRules({
    rules: [
      // Блочные
      headingRule(schema.nodes.heading, 6),
      hrRule(schema.nodes.horizontal_rule),
      codeBlockRule(schema.nodes.code_block),
      blockQuoteRule(schema.nodes.blockquote),
      bulletListRule(schema.nodes.bullet_list),
      orderedListRule(schema.nodes.ordered_list),

      // Инлайн: **text** → bold
      markInputRule(
        /\*\*([^*]+)\*\*$/,
        schema.marks.strong
      ),

      // Инлайн: *text* → italic (не ловить **)
      markInputRule(
        /(?<!\*)\*([^*]+)\*$/,
        schema.marks.em
      ),

      // Инлайн: `text` → code
      markInputRule(
        /`([^`]+)`$/,
        schema.marks.code
      ),

      // Инлайн: ~~text~~ → strikethrough
      markInputRule(
        /~~([^~]+)~~$/,
        schema.marks.s
      ),

      // Инлайн: ==text== → highlight
      markInputRule(
        /==([^=]+)==$/,
        schema.marks.highlight
      ),
    ],
  })
}
