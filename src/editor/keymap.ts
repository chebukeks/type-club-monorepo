/**
 * keymap.ts — Горячие клавиши для ProseMirror
 *
 * MVP: Ctrl+B (bold), Ctrl+I (italic), Ctrl+E (code),
 *      Enter (split block), Backspace, etc.
 */
import { keymap } from 'prosemirror-keymap'
import { toggleMark } from 'prosemirror-commands'
import { baseKeymap } from 'prosemirror-commands'
import { undo, redo } from 'prosemirror-history'
import { schema } from './schema'
import type { Plugin } from 'prosemirror-state'

/** Кастомные горячие клавиши */
const customKeymap = keymap({
  // Форматирование
  'Mod-b': toggleMark(schema.marks.strong),
  'Mod-i': toggleMark(schema.marks.em),
  'Mod-e': toggleMark(schema.marks.code),

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
