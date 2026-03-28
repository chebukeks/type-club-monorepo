/**
 * keymap.ts — Горячие клавиши для ProseMirror
 */
import { keymap } from 'prosemirror-keymap'
import { toggleMark, wrapIn, chainCommands } from 'prosemirror-commands'
import { baseKeymap } from 'prosemirror-commands'
import { undo, redo } from 'prosemirror-history'
import { splitListItem, sinkListItem, liftListItem } from 'prosemirror-schema-list'
import { addRowAfter, deleteRow, CellSelection } from 'prosemirror-tables'
import { Command, TextSelection } from 'prosemirror-state'
import { schema } from './schema'
import type { Plugin } from 'prosemirror-state'

// Команда: выход из блоков кода и таблиц по Esc
const exitBlockByEsc: Command = (state, dispatch) => {
  const { $head } = state.selection
  
  let blockDepth = -1

  for (let d = $head.depth; d > 0; d--) {
    const name = $head.node(d).type.name
    if (name === 'table' || name === 'code_block' || name === 'math_block') {
      blockDepth = d
      break
    }
  }
  if (blockDepth === -1) return false
  
  if (dispatch) {
    // Для блочных элементов вставляем новый пустой параграф ниже
    const endPos = $head.after(blockDepth)
    const tr = state.tr
    tr.insert(endPos, schema.nodes.paragraph.createAndFill()!)
    tr.setSelection(TextSelection.near(tr.doc.resolve(endPos + 1)))
    dispatch(tr)
  }
  return true
}

// Команда: автосоздание таблицы при вводе |col1|col2| и нажатии Enter
const createTableOnEnter: Command = (state, dispatch) => {
  const { $head } = state.selection
  if ($head.parent.type.name !== 'paragraph') return false
  
  const text = $head.parent.textContent
  const match = text.match(/^\|(.+)\|$/)
  if (!match) return false

  const cols = match[1].split('|').map(c => c.trim())
  
  if (dispatch) {
    // ВАЖНО: ячейки ProseMirror требуют "block+", то есть параграфа внутри!
    const headerCells = cols.map(c => {
      const textNode = c ? schema.text(c) : null
      const p = textNode ? schema.nodes.paragraph.create(null, textNode) : schema.nodes.paragraph.create()
      return schema.nodes.table_header.create(null, p)
    })
    
    const bodyCells = cols.map(() => {
      return schema.nodes.table_cell.create(null, schema.nodes.paragraph.create())
    })
    
    const table = schema.nodes.table.create(null, [
      schema.nodes.table_row.create(null, headerCells),
      schema.nodes.table_row.create(null, bodyCells)
    ])
    
    const tr = state.tr.replaceWith($head.before(), $head.after(), table)
    
    // Переносим курсор в первую ячейку тела таблицы
    // table_open(1) + tr_open(1) + firstRowSize
    const targetPos = $head.before() + 1 + table.firstChild!.nodeSize + 1
    tr.setSelection(TextSelection.near(tr.doc.resolve(targetPos)))
    
    dispatch(tr)
  }
  return true
}

// Команда: навигация Enter внутри таблицы
const tableEnterNav: Command = (state, dispatch) => {
  const { $head } = state.selection
  let rowDepth = -1
  for (let d = $head.depth; d > 0; d--) {
    if ($head.node(d).type.name === 'table_row') {
      rowDepth = d
      break
    }
  }
  if (rowDepth === -1) return false

  const posAfterRow = $head.after(rowDepth)
  const isLastRow = posAfterRow === $head.end(rowDepth - 1)

  if (isLastRow) {
    // В конце таблицы: создаём новую строку (стандартная команда prosemirror-tables)
    if (dispatch) return addRowAfter(state, dispatch)
    return true
  } else {
    // Переход в первую ячейку следующей строки
    if (dispatch) {
       const tr = state.tr
       tr.setSelection(TextSelection.near(tr.doc.resolve(posAfterRow + 2)))
       dispatch(tr)
    }
    return true
  }
}

// Команда: удаление выделенной строки таблицы по Backspace
const tableBackspaceCommand: Command = (state, dispatch) => {
  const { selection } = state
  if (selection instanceof CellSelection && selection.isRowSelection()) {
    if (dispatch) {
      deleteRow(state, dispatch)
    }
    return true
  }
  return false
}

// Команда: автосоздание математического блока по $$ + Enter
const createMathBlockOnEnter: Command = (state, dispatch) => {
  const { $head } = state.selection
  if ($head.parent.type.name !== 'paragraph') return false
  
  if ($head.parent.textContent.trim() === '$$') {
    if (dispatch) {
      const start = $head.before()
      const end = $head.after()
      const tr = state.tr.replaceWith(start, end, schema.nodes.math_block.create())
      tr.setSelection(TextSelection.near(tr.doc.resolve(start + 1)))
      dispatch(tr)
    }
    return true
  }
  return false
}

/** Кастомные горячие клавиши */
const customKeymap = keymap({
  // Форматирование
  'Mod-b': toggleMark(schema.marks.strong),
  'Mod-i': toggleMark(schema.marks.em),
  'Mod-e': toggleMark(schema.marks.code),
  'Mod-Shift-s': toggleMark(schema.marks.s),
  'Mod-Shift-h': toggleMark(schema.marks.highlight),
  'Mod-Shift-.': wrapIn(schema.nodes.blockquote),

  // Умный Enter: цепочка команд (первая вернувшая true перехватывает событие)
  'Enter': chainCommands(
    tableEnterNav,
    createMathBlockOnEnter,
    createTableOnEnter,
    splitListItem(schema.nodes.list_item)
  ),

  // Удаление строк таблицы (через Backspace)
  'Backspace': tableBackspaceCommand,

  // Выход из блоков:
  'Escape': exitBlockByEsc,

  // Списки
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
