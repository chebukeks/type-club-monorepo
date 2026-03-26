/**
 * keymap.ts — Горячие клавиши для ProseMirror
 *
 * MVP: Ctrl+B (bold), Ctrl+I (italic), Ctrl+E (code),
 *      Enter (split block), Backspace, etc.
 */
import { keymap } from 'prosemirror-keymap'
import { toggleMark, wrapIn } from 'prosemirror-commands'
import { baseKeymap } from 'prosemirror-commands'
import { undo, redo } from 'prosemirror-history'
import { splitListItem, sinkListItem, liftListItem } from 'prosemirror-schema-list'
import { schema } from './schema'
import type { Plugin } from 'prosemirror-state'

/** Кастомные горячие клавиши */
const customKeymap = keymap({
  // Форматирование
  'Mod-b': toggleMark(schema.marks.strong),
  'Mod-i': toggleMark(schema.marks.em),
  'Mod-e': toggleMark(schema.marks.code),
  'Mod-Shift-s': toggleMark(schema.marks.s),
  'Mod-Shift-h': toggleMark(schema.marks.highlight),
  'Mod-Shift-.': wrapIn(schema.nodes.blockquote),

  // Списки
  'Enter': splitListItem(schema.nodes.list_item),
  'Tab': sinkListItem(schema.nodes.list_item),
  'Shift-Tab': liftListItem(schema.nodes.list_item),

  // Undo/Redo
  'Mod-z': undo,
  'Mod-Shift-z': redo,
  'Mod-y': redo,
})

/** Базовые клавиши (Enter, Backspace, Delete, etc.) */
const baseKeys = keymap(baseKeymap)

/** Все клавиатурные плагины в правильном порядке */
export function getKeymapPlugins(): Plugin[] {
  return [customKeymap, baseKeys]
}
