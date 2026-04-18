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

function taskListRule() {
  return new InputRule(
    /^\[([ xX])\]\s$/,
    (state, match, start, end) => {
      const $start = state.doc.resolve(start)
      if ($start.parent.type !== state.schema.nodes.paragraph || $start.depth < 2) return null
      
      const listItemPos = $start.before(-1)
      const node = state.doc.nodeAt(listItemPos)
      if (node?.type !== state.schema.nodes.list_item) return null

      const tr = state.tr
      tr.delete(start, end)
      tr.setNodeMarkup(listItemPos, null, { checked: match[1] !== ' ' })
      return tr
    }
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
// Картинки и Ссылки
// ============================================================

function linkRule(): InputRule {
  return new InputRule(
    /(?:^|\s)\[([^\[]+)\]\(([^)]+)\)$/,
    (state, match, start, end) => {
      const [all, text, href] = match
      const tr = state.tr
      const trStart = start + (all.match(/^\s/) ? 1 : 0)
      
      const mark = schema.marks.link.create({ href })
      tr.replaceWith(trStart, end, schema.text(text, [mark]))
      tr.removeStoredMark(schema.marks.link)
      return tr
    }
  )
}

function imageRule(): InputRule {
  return new InputRule(
    /(?:^|\s)!\[([^\[]*)\]\(([^)]+)\)$/,
    (state, match, start, end) => {
      const [all, alt, src] = match
      const trStart = start + (all.match(/^\s/) ? 1 : 0)
      const node = schema.nodes.image.create({ src, alt })
      return state.tr.replaceWith(trStart, end, node)
    }
  )
}

// ============================================================
// Формулы
// ============================================================

function singleMathInlineRule(): InputRule {
  return new InputRule(
    /(?:[^\\]|^|\s)\$$/,
    (state, match, start, end) => {
      const trStart = start + match[0].indexOf('$')
      const tr = state.tr
      
      // Создаем math_inline с пробелом (пробел нужен, чтобы браузер мог поставить каретку)
      const node = schema.nodes.math_inline.create(null, schema.text(' '))
      tr.replaceWith(trStart, end, node)
      
      // Ставим TextSelection ровно перед пробелом
      tr.setSelection(TextSelection.create(tr.doc, trStart + 1))
      return tr
    }
  )
}

function mathBlockRule(): InputRule {
  return textblockTypeInputRule(/^\$\$\s$/, schema.nodes.math_block)
}

// ============================================================
// Типографика
// ============================================================

/** Автозамена `--` → `—` (длинное тире).
 *  Ctrl+Z отменяет замену (встроенная поддержка InputRules). */
function emDashRule(): InputRule {
  return new InputRule(/--$/, (state, _match, start, end) => {
    return state.tr.replaceWith(start, end, schema.text('—'))
  })
}

// ============================================================
// Экспорт
// ============================================================

export function getInputRulesPlugin(): Plugin {
  return inputRules({
    rules: [
      // Блочные
      mathBlockRule(),
      headingRule(schema.nodes.heading, 6),
      hrRule(schema.nodes.horizontal_rule),
      codeBlockRule(schema.nodes.code_block),
      blockQuoteRule(schema.nodes.blockquote),
      bulletListRule(schema.nodes.bullet_list),
      orderedListRule(schema.nodes.ordered_list),

      // Чекбоксы в списках (вводим [ ] или [x] внутри списка)
      taskListRule(),

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

      // Инлайн: ||text|| → spoiler
      markInputRule(
        /\|\|([^|]+)\|\|$/,
        schema.marks.spoiler
      ),

      // Типографика: -- → —
      emDashRule(),

      // Формулы
      singleMathInlineRule(),

      // Ссылки и картинки
      imageRule(),
      linkRule(),
    ],
  })
}
