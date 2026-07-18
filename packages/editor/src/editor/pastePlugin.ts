/**
 * pastePlugin.ts — Умная вставка из буфера обмена
 *
 * Поведение зависит от того, что было скопировано:
 * - «Блочные» ноды (таблицы, изображения, блоки кода/математики, hr),
 *   скопированные целиком (закрытый slice), вставляются как отдельный блок
 *   ПОСЛЕ текущего абзаца (пустой абзац — заменяется).
 * - Обычные текстовые блоки (абзацы, заголовки), скопированные целиком
 *   (например, тройным кликом), «раскрываются» и вливаются в текст
 *   в месте курсора — без разрезания абзаца.
 * - Всё остальное (частичные выделения, внешний HTML) — дефолтное
 *   поведение ProseMirror.
 *
 * Чтобы новый блочный элемент вставлялся «как таблица» — добавь имя его
 * ноды в BLOCK_PASTE_NODES.
 */
import { Plugin, PluginKey, TextSelection, NodeSelection } from 'prosemirror-state'
import { Slice } from 'prosemirror-model'
import type { EditorView } from 'prosemirror-view'

export const pastePluginKey = new PluginKey('smartPaste')

/** Ноды, которые при вставке ведут себя как самостоятельные блоки */
export const BLOCK_PASTE_NODES = new Set([
  'table',
  'image',
  'code_block',
  'math_block',
  'horizontal_rule',
])

/** Закрытый slice, целиком состоящий из блочных нод из списка */
function isBlockSlice(slice: Slice): boolean {
  if (slice.openStart !== 0 || slice.openEnd !== 0 || slice.content.childCount === 0) return false
  let all = true
  slice.content.forEach((child) => {
    if (!BLOCK_PASTE_NODES.has(child.type.name)) all = false
  })
  return all
}

/** Закрытый slice из обычных текстовых блоков — вставляем как текст */
function isClosedTextSlice(slice: Slice): boolean {
  if (slice.openStart !== 0 || slice.openEnd !== 0 || slice.content.childCount === 0) return false
  let all = true
  slice.content.forEach((child) => {
    if (!child.isTextblock || BLOCK_PASTE_NODES.has(child.type.name)) all = false
  })
  return all
}

function handleBlockPaste(view: EditorView, slice: Slice): boolean {
  const { state } = view
  if (state.selection instanceof NodeSelection) return false

  const tr = state.tr
  if (!state.selection.empty) tr.deleteSelection()

  const { $head } = tr.selection
  let blockDepth = -1
  for (let d = $head.depth; d >= 1; d--) {
    const name = $head.node(d).type.name
    if (name === 'paragraph' || name === 'heading' || name === 'code_block' || name === 'math_block') {
      blockDepth = d
      break
    }
  }
  if (blockDepth === -1) return false

  const blockStart = $head.before(blockDepth)
  const blockEnd = $head.after(blockDepth)
  const isEmpty = $head.node(blockDepth).textContent.trim() === ''

  try {
    let insertEnd: number
    if (isEmpty) {
      tr.replaceWith(blockStart, blockEnd, slice.content)
      insertEnd = blockStart + slice.content.size
    } else {
      tr.insert(blockEnd, slice.content)
      insertEnd = blockEnd + slice.content.size
    }
    tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(insertEnd, tr.doc.content.size)), 1))
  } catch {
    return false
  }

  view.dispatch(tr.scrollIntoView())
  return true
}

export function pastePlugin(): Plugin {
  return new Plugin({
    key: pastePluginKey,
    props: {
      transformPasted(slice) {
        if (isClosedTextSlice(slice)) return Slice.maxOpen(slice.content)
        return slice
      },
      handlePaste(view, _event, slice) {
        if (!isBlockSlice(slice)) return false
        return handleBlockPaste(view, slice)
      },
    },
  })
}
