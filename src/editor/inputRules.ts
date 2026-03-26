/**
 * inputRules.ts — Правила автоматического форматирования при вводе
 *
 * Когда пользователь набирает определённую последовательность,
 * она автоматически превращается в PM-ноду.
 *
 * MVP:
 * - `# ` в начале строки → heading 1 (## → h2, и т.д.)
 * - `---` + Enter → horizontal_rule
 */
import {
  inputRules,
  textblockTypeInputRule,
  InputRule,
} from 'prosemirror-inputrules'
import { schema } from './schema'
import type { Plugin } from 'prosemirror-state'
import { NodeType } from 'prosemirror-model'

/**
 * Правило: `# ` → heading c нужным уровнем.
 * Работает для # – ######
 */
function headingRule(nodeType: NodeType, maxLevel: number) {
  return textblockTypeInputRule(
    new RegExp(`^(#{1,${maxLevel}})\\s$`),
    nodeType,
    match => ({ level: match[1].length })
  )
}

/**
 * Правило: `---` в начале строки → horizontal_rule
 */
function hrRule(nodeType: NodeType) {
  return new InputRule(
    /^---$/,
    (state, _match, start, end) => {
      const tr = state.tr
      // Заменяем текст на HR
      tr.replaceWith(start - 1, end, nodeType.create())
      return tr
    }
  )
}

/** Все input rules */
export function getInputRulesPlugin(): Plugin {
  return inputRules({
    rules: [
      headingRule(schema.nodes.heading, 6),
      hrRule(schema.nodes.horizontal_rule),
    ],
  })
}
