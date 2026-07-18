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
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import { Slice, Fragment } from 'prosemirror-model'
import type { Node as PMNode } from 'prosemirror-model'

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

/** Закрытый slice из текста и ОДНОГО текстового блока — схлопываем в инлайн */
function isClosedTextSlice(slice: Slice): boolean {
  if (slice.openStart !== 0 || slice.openEnd !== 0 || slice.content.childCount === 0) return false
  let textblockCount = 0
  let nonMatching = false
  slice.content.forEach((child) => {
    if (BLOCK_PASTE_NODES.has(child.type.name)) nonMatching = true
    else if (child.isTextblock) textblockCount++
    else if (!child.isText) nonMatching = true
  })
  return !nonMatching && textblockCount === 1
}

import type { EditorView } from 'prosemirror-view'

/** Собрать весь текст из слайса в открытый параграф (1,1), сохраняя марки */
function flattenToOpenSlice(slice: Slice, view: EditorView): Slice {
  const nodes: PMNode[] = []
  slice.content.forEach((child) => {
    if (child.isText) nodes.push(child)
    else if (child.isTextblock) child.content.forEach((c: PMNode) => nodes.push(c))
  })
  const schema = view.state.schema
  const para = schema.node('paragraph', null, nodes)
  return Slice.maxOpen(Fragment.from(para))
}

function describeSlice(slice: Slice): string {
  const names: string[] = []
  slice.content.forEach((c) => names.push(c.type.name))
  return `(${slice.openStart},${slice.openEnd}) [${names.join(', ')}]`
}

function handleBlockPaste(view: EditorView, slice: Slice): boolean {
  const { state } = view
  if (!state.selection.empty) return false

  const tr = state.tr
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
  console.log('[pastePlugin] LOADED')
  return new Plugin({
    key: pastePluginKey,
    props: {
      transformPasted(slice, view) {
        const before = describeSlice(slice)
        if (isClosedTextSlice(slice)) {
          const opened = flattenToOpenSlice(slice, view)
          console.log('[pastePlugin] transformPasted', before, '→ flattenOpen', describeSlice(opened))
          return opened
        }
        console.log('[pastePlugin] transformPasted', before, '(unchanged)')
        return slice
      },
      handlePaste(view, _event, slice) {
        console.log('[pastePlugin] handlePaste', describeSlice(slice), 'selection:', view.state.selection.empty ? 'empty' : view.state.selection.constructor.name)
        if (!isBlockSlice(slice)) {
          console.log('[pastePlugin] handlePaste → false (not block)')
          return false
        }
        console.log('[pastePlugin] handlePaste → handleBlockPaste')
        return handleBlockPaste(view, slice)
      },
    },
  })
}
