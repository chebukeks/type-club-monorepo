/**
 * keymap.ts — Горячие клавиши для ProseMirror
 */
import { keymap } from 'prosemirror-keymap'
import { toggleMark, wrapIn, chainCommands } from 'prosemirror-commands'
import { baseKeymap } from 'prosemirror-commands'
import { undo as pmUndo, redo as pmRedo } from 'prosemirror-history'
import { undo as yUndo, redo as yRedo } from 'y-prosemirror'
import { splitListItem, sinkListItem, liftListItem } from 'prosemirror-schema-list'
import { addRowAfter, deleteRow, CellSelection } from 'prosemirror-tables'
import { Command, TextSelection, NodeSelection, EditorState } from 'prosemirror-state'
import { schema } from './schema'
import type { Plugin } from 'prosemirror-state'

/**
 * Универсальная команда выхода:
 * - Для инлайн-элементов (math_inline, активные инлайн-марки) — выход дальше на ту же строку (снимает стили или переводит каретку за инлайн-ноду).
 * - Для блочных элементов (code_block, table, math_block, blockquote, list_item) — выход на новую строку ниже (создаёт новый параграф).
 */
export const universalExitCommand: Command = (state, dispatch) => {
  const { $head, empty } = state.selection

  // 1. Инлайн-математика: выход за пределы math_inline на ту же строку
  if ($head.parent.type.name === 'math_inline') {
    if (dispatch) {
      const text = $head.parent.textContent
      const trimmed = text.trim()
      const nodeStart = $head.before()
      const nodeEnd = $head.after()
      if (trimmed.length === 0) {
        let tr = state.tr.replaceWith(nodeStart, nodeEnd, schema.text('$'))
        tr.setSelection(TextSelection.near(tr.doc.resolve(nodeStart + 1)))
        dispatch(tr)
      } else if (trimmed !== text) {
        const newNode = $head.parent.type.create(null, schema.text(trimmed))
        let tr = state.tr.replaceWith(nodeStart, nodeEnd, newNode)
        const newNodeEnd = nodeStart + trimmed.length + 2
        tr.setSelection(TextSelection.near(tr.doc.resolve(newNodeEnd)))
        dispatch(tr)
      } else {
        let tr = state.tr
        tr.setSelection(TextSelection.near(tr.doc.resolve(nodeEnd)))
        dispatch(tr)
      }
    }
    return true
  }

  // 2. Инлайн-стили: если активны марки у каретки (storedMarks или marks) — перемещаем каретку за пределы стиля в том же параграфе
  const activeMarks = state.storedMarks || (empty ? $head.marks() : [])
  if (activeMarks && activeMarks.length > 0) {
    if (dispatch) {
      let tr = state.tr
      const parent = $head.parent
      const parentStart = $head.start()
      const offset = $head.parentOffset

      // Находим правую границу текущего стиля в пределах текстового блока
      let exitOffset = offset
      let curOffset = 0
      for (let i = 0; i < parent.childCount; i++) {
        const child = parent.child(i)
        const childStart = curOffset
        const childEnd = curOffset + child.nodeSize

        if (childStart <= offset && offset <= childEnd) {
          let end = childEnd
          for (let j = i + 1; j < parent.childCount; j++) {
            const nextChild = parent.child(j)
            const hasAnyMark = nextChild.marks.some(m => activeMarks.some(a => a.type === m.type))
            if (hasAnyMark) {
              end += nextChild.nodeSize
            } else {
              break
            }
          }
          exitOffset = end
          break
        }
        curOffset = childEnd
      }

      const targetPos = parentStart + exitOffset
      tr.setSelection(TextSelection.near(tr.doc.resolve(targetPos)))
      tr.setStoredMarks([])
      dispatch(tr.scrollIntoView())
    }
    return true
  }

  // 3. Блочные элементы: table, code_block, math_block, blockquote, list_item
  for (let d = $head.depth; d > 0; d--) {
    const node = $head.node(d)
    const name = node.type.name

    if (name === 'table' || name === 'code_block' || name === 'math_block' || name === 'blockquote') {
      if (dispatch) {
        const endPos = $head.after(d)
        const tr = state.tr
        const p = schema.nodes.paragraph.createAndFill()!
        tr.insert(endPos, p)
        tr.setSelection(TextSelection.near(tr.doc.resolve(endPos + 1)))
        dispatch(tr.scrollIntoView())
      }
      return true
    }

    if (name === 'list_item') {
      // Ищем родительский список верхнего уровня
      let listDepth = d
      for (let ld = d - 1; ld > 0; ld--) {
        const parentName = $head.node(ld).type.name
        if (parentName === 'bullet_list' || parentName === 'ordered_list') {
          listDepth = ld
        } else if (parentName !== 'list_item') {
          break
        }
      }
      if (dispatch) {
        const endPos = $head.after(listDepth)
        const tr = state.tr
        const p = schema.nodes.paragraph.createAndFill()!
        tr.insert(endPos, p)
        tr.setSelection(TextSelection.near(tr.doc.resolve(endPos + 1)))
        dispatch(tr.scrollIntoView())
      }
      return true
    }
  }

  // 4. Обычный параграф / заголовок без активных марок: создаём новый параграф ниже
  if (dispatch) {
    const depth = $head.depth > 0 ? 1 : 0
    const endPos = $head.after(depth)
    const tr = state.tr
    const p = schema.nodes.paragraph.createAndFill()!
    tr.insert(endPos, p)
    tr.setSelection(TextSelection.near(tr.doc.resolve(endPos + 1)))
    dispatch(tr.scrollIntoView())
  }
  return true
}

const exitBlockByEsc: Command = universalExitCommand

// Команда: автосоздание таблицы при вводе |col1|col2| и нажатии Enter
const createTableOnEnter: Command = (state, dispatch) => {
  const { $head } = state.selection
  if ($head.parent.type.name !== 'paragraph') return false
  
  const text = $head.parent.textContent
  // Если это спойлер (начинается и заканчивается на ||), не расцениваем это как таблицу
  if (/^\|\|.*\|\|$/.test(text)) return false

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

// Команда: автосоздание блока кода по ``` + Enter
const createCodeBlockOnEnter: Command = (state, dispatch) => {
  const { $head } = state.selection
  if ($head.parent.type.name !== 'paragraph') return false
  
  const text = $head.parent.textContent
  const match = text.match(/^```([a-zA-Z0-9]*)$/)
  if (match) {
    if (dispatch) {
      const start = $head.before()
      const end = $head.after()
      const params = match[1]
      const tr = state.tr.replaceWith(start, end, schema.nodes.code_block.create({ params }))
      tr.setSelection(TextSelection.near(tr.doc.resolve(start + 1)))
      dispatch(tr)
    }
    return true
  }
  return false
}

// Команда: удаление пустого блока кода по Backspace
const codeBlockBackspaceCommand: Command = (state, dispatch) => {
  const { $head } = state.selection
  if ($head.parent.type.name !== 'code_block') return false
  if ($head.parent.textContent.length === 0) {
    if (dispatch) {
      const start = $head.before()
      const end = $head.after()
      const tr = state.tr.replaceWith(start, end, schema.nodes.paragraph.create())
      tr.setSelection(TextSelection.near(tr.doc.resolve(start + 1)))
      dispatch(tr)
    }
    return true
  }
  return false
}

// ===== ИНЛАЙН МАТЕМАТИКА (TYPORA STYLE) =====

const mathBackspaceCommand: Command = (state, dispatch) => {
  const { $head } = state.selection
  if ($head.parent.type.name !== 'math_inline') return false
  
  const text = $head.parent.textContent
  const textTrimmed = text.trim()
  const posInside = $head.parentOffset
  
  if (textTrimmed.length === 0) {
    if (dispatch) {
      // Пустая формула -> полностью удаляем
      let tr = state.tr
      tr.delete($head.before(), $head.after())
      dispatch(tr)
    }
    return true
  }
  
  if (posInside === 0 || (posInside === 1 && text.startsWith(' '))) {
    if (dispatch) {
      // Удаляем "левый" $ -> превращаем остаток в текст с правым $
      const rawFormula = textTrimmed
      let tr = state.tr
      tr.replaceWith($head.before(), $head.after(), schema.text(rawFormula + '$'))
      tr.setSelection(TextSelection.near(tr.doc.resolve($head.before())))
      dispatch(tr)
    }
    return true
  }
  return false
}

const mathDeleteCommand: Command = (state, dispatch) => {
  const { $head } = state.selection
  if ($head.parent.type.name !== 'math_inline') return false
  
  const text = $head.parent.textContent
  const textTrimmed = text.trim()
  const posInside = $head.parentOffset
  const textLen = text.length
  
  if (textTrimmed.length === 0) {
    if (dispatch) {
      // Пустая формула -> оставляем только первый $
      let tr = state.tr
      tr.replaceWith($head.before(), $head.after(), schema.text('$'))
      tr.setSelection(TextSelection.near(tr.doc.resolve($head.before() + 1)))
      dispatch(tr)
    }
    return true
  }
  
  if (posInside === textLen || (posInside === textLen - 1 && text.endsWith(' '))) {
    if (dispatch) {
      // Удаляем "правый" $ -> превращаем остаток в текст с левым $
      const rawFormula = textTrimmed
      let tr = state.tr
      tr.replaceWith($head.before(), $head.after(), schema.text('$' + rawFormula))
      tr.setSelection(TextSelection.near(tr.doc.resolve($head.before() + rawFormula.length + 1)))
      dispatch(tr)
    }
    return true
  }
  return false
}

const mathSpaceCommand: Command = (state, dispatch) => {
  const { $head } = state.selection
  if ($head.parent.type.name !== 'math_inline') return false
  
  if ($head.parent.textContent.trim().length === 0) {
    if (dispatch) {
      let tr = state.tr
      tr.replaceWith($head.before(), $head.after(), schema.text('$ '))
      tr.setSelection(TextSelection.near(tr.doc.resolve($head.before() + 2)))
      dispatch(tr)
    }
    return true
  }
  return false
}


const mathEscCommand: Command = (state, dispatch) => {
  const { $head } = state.selection
  if ($head.parent.type.name === 'math_inline') {
    if ($head.parent.textContent.trim().length === 0) {
      if (dispatch) {
        let tr = state.tr
        tr.replaceWith($head.before(), $head.after(), schema.text('$'))
        tr.setSelection(TextSelection.near(tr.doc.resolve($head.before() + 1)))
        dispatch(tr)
      }
      return true
    } else {
      if (dispatch) {
        // Сначала trim, затем переставляем курсор
        const text = $head.parent.textContent
        const trimmed = text.trim()
        const nodeStart = $head.before()
        const nodeEnd = $head.after()
        if (trimmed !== text && trimmed.length > 0) {
          const newNode = $head.parent.type.create(null, schema.text(trimmed))
          let tr = state.tr.replaceWith(nodeStart, nodeEnd, newNode)
          // Нода пересоздана, ее размер = trimmed.length + 2
          const newNodeEnd = nodeStart + trimmed.length + 2
          tr.setSelection(TextSelection.near(tr.doc.resolve(newNodeEnd)))
          dispatch(tr)
        } else {
          let tr = state.tr
          tr.setSelection(TextSelection.near(tr.doc.resolve($head.after())))
          dispatch(tr)
        }
      }
      return true
    }
  }
  return exitBlockByEsc(state, dispatch)
}

const mathEnterCommand: Command = (state, dispatch) => {
  const { $head } = state.selection
  if ($head.parent.type.name === 'math_inline') {
    if ($head.parent.textContent.trim().length === 0) {
      if (dispatch) {
        let tr = state.tr
        tr.replaceWith($head.before(), $head.after(), schema.text('$'))
        tr.setSelection(TextSelection.near(tr.doc.resolve($head.before() + 1)))
        dispatch(tr)
      }
      return true
    } else {
      if (dispatch) {
        const text = $head.parent.textContent
        const trimmed = text.trim()
        const nodeStart = $head.before()
        const nodeEnd = $head.after()
        if (trimmed !== text && trimmed.length > 0) {
          const newNode = $head.parent.type.create(null, schema.text(trimmed))
          let tr = state.tr.replaceWith(nodeStart, nodeEnd, newNode)
          const newNodeEnd = nodeStart + trimmed.length + 2
          tr.setSelection(TextSelection.near(tr.doc.resolve(newNodeEnd)))
          dispatch(tr)
        } else {
          let tr = state.tr
          tr.setSelection(TextSelection.near(tr.doc.resolve($head.after())))
          dispatch(tr)
        }
      }
      return true
    }
  }
  return false
}

const mathDollarCommand: Command = (state, dispatch) => {
  const { $head } = state.selection
  if ($head.parent.type.name === 'math_inline') {
    if ($head.parent.textContent.trim().length === 0) {
      if (dispatch) {
        let tr = state.tr
        tr.replaceWith($head.before(), $head.after(), schema.text('$$'))
        tr.setSelection(TextSelection.near(tr.doc.resolve($head.before() + 2)))
        dispatch(tr)
      }
      return true
    } else {
      if (dispatch) {
        // Сначала trim, затем выходим
        const text = $head.parent.textContent
        const trimmed = text.trim()
        const nodeStart = $head.before()
        const nodeEnd = $head.after()
        if (trimmed !== text && trimmed.length > 0) {
          const newNode = $head.parent.type.create(null, schema.text(trimmed))
          let tr = state.tr.replaceWith(nodeStart, nodeEnd, newNode)
          const newNodeEnd = nodeStart + trimmed.length + 2
          tr.setSelection(TextSelection.near(tr.doc.resolve(newNodeEnd)))
          dispatch(tr)
        } else {
          let tr = state.tr
          tr.setSelection(TextSelection.near(tr.doc.resolve($head.after())))
          dispatch(tr)
        }
      }
      return true
    }
  }
  return false
}

// =========================================================

// Команда: пропуск math_inline стрелками (ArrowRight/ArrowLeft)
// Когда курсор стоит прямо перед/после неактивной ноды — перепрыгиваем через неё целиком
const mathArrowRightCommand: Command = (state, dispatch) => {
  const { $head } = state.selection
  if ($head.parent.type.name === 'math_inline') return false
  const nodeAfter = $head.nodeAfter
  if (nodeAfter?.type.name === 'math_inline') {
    if (dispatch) {
      const target = $head.pos + nodeAfter.nodeSize
      dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(target), 1)))
    }
    return true
  }
  return false
}

const mathArrowLeftCommand: Command = (state, dispatch) => {
  const { $head } = state.selection
  if ($head.parent.type.name === 'math_inline') return false
  const nodeBefore = $head.nodeBefore
  if (nodeBefore?.type.name === 'math_inline') {
    if (dispatch) {
      const target = $head.pos - nodeBefore.nodeSize
      dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(target), -1)))
    }
    return true
  }
  return false
}

const headingBackspace: Command = (state, dispatch) => {
  const { $head } = state.selection
  if (!state.selection.empty) return false
  if ($head.parent.type.name !== 'heading') return false
  if ($head.parentOffset !== 0) return false // только в крайней левой позиции

  const level = $head.parent.attrs.level
  if (dispatch) {
    const pos = $head.before()
    const end = $head.after()
    if (level <= 1) {
      // h1 → paragraph: заменяем заголовок на параграф с тем же содержимым
      const content = $head.parent.content
      const tr = state.tr.replaceWith(pos, end, schema.nodes.paragraph.create(null, content))
      tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)))
      dispatch(tr)
    } else {
      // h3→h2, h2→h1 и т.д.: уменьшаем уровень
      const tr = state.tr.setNodeMarkup(pos, undefined, { level: level - 1 })
      dispatch(tr)
    }
  }
  return true
}

// Команда: установить уровень заголовка (Ctrl+1..6)
// Работает только с параграфами и заголовками.
function setHeadingLevel(level: number): Command {
  return (state, dispatch) => {
    const { $head } = state.selection
    const parentType = $head.parent.type.name
    if (parentType !== 'paragraph' && parentType !== 'heading') return false

    if (dispatch) {
      const pos = $head.before()
      if (level === 0 || (parentType === 'heading' && $head.parent.attrs.level === level)) {
        // Если 0 или уже такой уровень — превращаем обратно в параграф
        const content = $head.parent.content
        const tr = state.tr.replaceWith(pos, $head.after(), schema.nodes.paragraph.create(null, content))
        tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)))
        dispatch(tr)
      } else {
        // Превращаем в заголовок нужного уровня
        const tr = state.tr.setNodeMarkup(pos, schema.nodes.heading, { level })
        dispatch(tr)
      }
    }
    return true
  }
}

/** Выделение только текста внутри блока кода по Ctrl+A */
const selectAllInCodeBlock: Command = (state, dispatch) => {
  const { $from, $to } = state.selection
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (node.type === schema.nodes.code_block) {
      const start = $from.start(d)
      const end = $from.end(d)
      if ($from.pos === start && $to.pos === end) {
        return true
      }
      if (dispatch) {
        dispatch(state.tr.setSelection(TextSelection.create(state.doc, start, end)))
      }
      return true
    }
  }
  return false
}

// Команда: выход из блока кода по двойному Enter (пустая строка в конце блока)
const codeBlockDoubleEnterExit: Command = (state, dispatch) => {
  const { $head, empty } = state.selection
  if (!empty) return false
  if ($head.parent.type.name !== 'code_block') return false

  const text = $head.parent.textContent
  const offset = $head.parentOffset
  if (offset > 0 && text[offset - 1] === '\n' && (offset === text.length || text[offset] === '\n')) {
    if (dispatch) {
      let codeDepth = -1
      for (let d = $head.depth; d > 0; d--) {
        if ($head.node(d).type.name === 'code_block') {
          codeDepth = d
          break
        }
      }
      if (codeDepth === -1) return false

      const start = $head.before(codeDepth)
      const end = $head.after(codeDepth)
      const newText = text.slice(0, offset - 1) + text.slice(offset)
      const newCodeNode = schema.nodes.code_block.create(
        $head.parent.attrs,
        newText ? schema.text(newText) : undefined
      )
      const tr = state.tr.replaceWith(start, end, newCodeNode)
      const insertPos = start + newCodeNode.nodeSize
      const p = schema.nodes.paragraph.createAndFill()!
      tr.insert(insertPos, p)
      tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)))
      dispatch(tr.scrollIntoView())
    }
    return true
  }
  return false
}

/** Кастомные горячие клавиши */
const customKeymap = keymap({
  // Выделение всего текста внутри блока кода
  'Mod-a': selectAllInCodeBlock,

  // Форматирование
  'Mod-b': toggleMark(schema.marks.strong),
  'Mod-i': toggleMark(schema.marks.em),
  'Mod-e': toggleMark(schema.marks.code),
  'Mod-Shift-x': toggleMark(schema.marks.s),
  'Mod-Shift-h': toggleMark(schema.marks.highlight),
  'Mod-Shift-.': wrapIn(schema.nodes.blockquote),

  // Уровни заголовков
  'Mod-1': setHeadingLevel(1),
  'Mod-2': setHeadingLevel(2),
  'Mod-3': setHeadingLevel(3),
  'Mod-4': setHeadingLevel(4),
  'Mod-5': setHeadingLevel(5),
  'Mod-6': setHeadingLevel(6),


  // Умный Enter: цепочка команд (первая вернувшая true перехватывает событие)
  'Enter': chainCommands(
    tableEnterNav,
    createMathBlockOnEnter,
    createCodeBlockOnEnter,
    mathEnterCommand,
    codeBlockDoubleEnterExit,
    createTableOnEnter,
    splitListItem(schema.nodes.list_item)
  ),

  // Математика, заголовки, блоки кода и табличный бэкспэйс
  'Backspace': chainCommands(mathBackspaceCommand, headingBackspace, tableBackspaceCommand, codeBlockBackspaceCommand),
  'Delete': mathDeleteCommand,
  'Space': mathSpaceCommand,
  '$': mathDollarCommand,
  'Escape': mathEscCommand,
  'ArrowRight': mathArrowRightCommand,
  'ArrowLeft': mathArrowLeftCommand,

  // Списки
  'Tab': sinkListItem(schema.nodes.list_item),

  'Shift-Tab': liftListItem(schema.nodes.list_item),

  // Undo/Redo
  'Mod-z': chainCommands(pmUndo, yUndo),
  'Mod-Shift-z': chainCommands(pmRedo, yRedo),
  'Mod-y': chainCommands(pmRedo, yRedo),

  // Suggestion Note (Ctrl+Q)
  'Mod-q': (state, dispatch) => {
    if (!state.schema.nodes.suggestion_note) return false;
    if (dispatch) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("editor-open-add-note-modal"));
      }
    }
    return true;
  },
})

// Команда: оборачивание выделенного текста в пару скобок/кавычек (#38)
function wrapSelection(open: string, close: string): Command {
  return (state, dispatch) => {
    const { from, to } = state.selection
    if (from === to) return false // нет выделения — пропустить

    if (dispatch) {
      const selectedText = state.doc.textBetween(from, to)
      const tr = state.tr.replaceWith(from, to, schema.text(open + selectedText + close))
      // Ставим курсор после закрывающей скобки
      tr.setSelection(TextSelection.create(tr.doc, from + 1, from + 1 + selectedText.length))
      dispatch(tr)
    }
    return true
  }
}

/** Клавиши для оборачивания выделения (#38) */
const bracketKeymap = keymap({
  '(': wrapSelection('(', ')'),
  '[': wrapSelection('[', ']'),
  '{': wrapSelection('{', '}'),
  '"': wrapSelection('"', '"'),
  "'": wrapSelection("'", "'"),
})

/** Базовые клавиши (Enter, Backspace, Delete, etc.) */
const baseKeys = keymap(baseKeymap)

/** Все клавиатурные плагины в правильном порядке */
export function getKeymapPlugins(): Plugin[] {
  return [customKeymap, bracketKeymap, baseKeys]
}

export const undoCommand: Command = chainCommands(pmUndo, yUndo)
export const redoCommand: Command = chainCommands(pmRedo, yRedo)
export const indentListCommand: Command = sinkListItem(schema.nodes.list_item)
export const outdentListCommand: Command = liftListItem(schema.nodes.list_item)
export { setHeadingLevel }

export function isInList(state: EditorState): boolean {
  const { $head } = state.selection
  for (let d = $head.depth; d > 0; d--) {
    const name = $head.node(d).type.name
    if (name === 'list_item' || name === 'bullet_list' || name === 'ordered_list') return true
  }
  return false
}

export function isInTable(state: EditorState): boolean {
  const { $head } = state.selection
  for (let d = $head.depth; d > 0; d--) {
    const name = $head.node(d).type.name
    if (name === 'table' || name === 'table_row' || name === 'table_cell' || name === 'table_header') return true
  }
  return false
}

export function isInCodeBlock(state: EditorState): boolean {
  const { $head } = state.selection
  for (let d = $head.depth; d > 0; d--) {
    const name = $head.node(d).type.name
    if (name === 'code_block') return true
  }
  return false
}

export function isInExitableBlock(state: EditorState): boolean {
  const { $head } = state.selection
  for (let d = $head.depth; d > 0; d--) {
    const name = $head.node(d).type.name
    if (
      name === 'table' ||
      name === 'table_row' ||
      name === 'table_cell' ||
      name === 'table_header' ||
      name === 'code_block' ||
      name === 'math_block' ||
      name === 'math_inline' ||
      name === 'blockquote' ||
      name === 'list_item'
    ) {
      return true
    }
  }
  return false
}

export function getActiveHeadingLevel(state: EditorState): number | null {
  const { $head } = state.selection
  if ($head.parent.type.name === 'heading') {
    return $head.parent.attrs.level
  }
  return null
}

export function getListType(state: EditorState): 'task' | 'bullet' | 'ordered' | null {
  const { $head } = state.selection
  for (let d = $head.depth; d > 0; d--) {
    const node = $head.node(d)
    if (node.type.name === 'list_item') {
      if (node.attrs.checked !== null && node.attrs.checked !== undefined) {
        return 'task'
      }
    }
    if (node.type.name === 'bullet_list') return 'bullet'
    if (node.type.name === 'ordered_list') return 'ordered'
  }
  return null
}

export function isInBlockquote(state: EditorState): boolean {
  const { $head } = state.selection
  for (let d = $head.depth; d > 0; d--) {
    if ($head.node(d).type.name === 'blockquote') return true
  }
  return false
}

export function isMarkActive(state: EditorState, markType: any): boolean {
  if (!markType) return false
  const { from, $from, to, empty } = state.selection
  if (empty) {
    return !!(state.storedMarks ? markType.isInSet(state.storedMarks) : markType.isInSet($from.marks()))
  }
  return state.doc.rangeHasMark(from, to, markType)
}

export function hasActiveInlineMarks(state: EditorState): boolean {
  if (state.storedMarks && state.storedMarks.length > 0) return true
  const { $head, empty } = state.selection
  if (empty && $head.marks().length > 0) return true
  return false
}

export function canExit(state: EditorState): boolean {
  return isInExitableBlock(state) || hasActiveInlineMarks(state)
}

export function isInMath(state: EditorState): boolean {
  if (state.selection instanceof NodeSelection) {
    const name = state.selection.node.type.name
    if (name === 'math_inline' || name === 'math_block') return true
  }
  const { $head } = state.selection
  if ($head.parent.type.name === 'math_inline' || $head.parent.type.name === 'math_block') return true
  for (let d = $head.depth; d > 0; d--) {
    const name = $head.node(d).type.name
    if (name === 'math_block' || name === 'math_inline') return true
  }
  return false
}
