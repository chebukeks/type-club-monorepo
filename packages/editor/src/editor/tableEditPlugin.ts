import { Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { getTranslation, type TranslationKey } from '../i18n'
import { tableEnterNav } from './keymap'
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  moveTableColumn,
  moveTableRow,
  TableMap,
} from 'prosemirror-tables'

export const tableEditPluginKey = new PluginKey<number | null>('tableEditPlugin')

let currentOverlay: HTMLElement | null = null
let doneBtn: HTMLElement | null = null
let scrollListener: (() => void) | null = null
let resizeListener: (() => void) | null = null

function makeControl(className: string, text: string, label: string): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  button.textContent = text
  button.title = label
  button.setAttribute('aria-label', label)
  button.addEventListener('pointerdown', event => event.preventDefault())
  return button
}

function hideAll() {
  if (currentOverlay) { currentOverlay.remove(); currentOverlay = null }
  if (doneBtn) { doneBtn.remove(); doneBtn = null }
  if (scrollListener) { window.removeEventListener('scroll', scrollListener, true); scrollListener = null }
  if (resizeListener) { window.removeEventListener('resize', resizeListener); resizeListener = null }
}

function updateOverlayPosition(view: EditorView, pos: number) {
  if (!currentOverlay || view.isDestroyed) return
  const livePos = tableEditPluginKey.getState(view.state) ?? pos
  const tableDom = view.nodeDOM(livePos) as HTMLElement
  if (!tableDom) { hideAll(); return }
  const table = (tableDom.tagName === 'TABLE' ? tableDom : tableDom.querySelector('table')) as HTMLTableElement | null
  if (!table || !table.rows || table.rows.length === 0) { hideAll(); return }

  const rect = table.getBoundingClientRect()
  const viewRect = view.dom.getBoundingClientRect()

  if (rect.bottom <= Math.max(viewRect.top, 0) || rect.top >= Math.min(viewRect.bottom, window.innerHeight) ||
      rect.right <= Math.max(viewRect.left, 0) || rect.left >= Math.min(viewRect.right, window.innerWidth)) {
    currentOverlay.style.display = 'none'
    if (doneBtn) doneBtn.style.display = 'none'
    return
  }

  currentOverlay.style.display = 'block'
  currentOverlay.style.left = `${rect.left}px`
  currentOverlay.style.top = `${rect.top}px`
  currentOverlay.style.width = `${rect.width}px`
  currentOverlay.style.height = `${rect.height}px`

  if (doneBtn) {
    doneBtn.style.display = 'block'
    const margin = 8
    const left = Math.max(margin, Math.min(rect.right, window.innerWidth - margin) - doneBtn.offsetWidth)
    const gap = left > rect.left + 28 ? 8 : 30
    const top = Math.max(margin, Math.min(rect.bottom + gap, window.innerHeight - doneBtn.offsetHeight - margin))
    doneBtn.style.left = `${left}px`
    doneBtn.style.top = `${top}px`
  }
}

function makeDragHandle(
  overlay: HTMLElement,
  className: 'te-col-drag' | 'te-row-drag',
  index: number,
  onMove: (from: number, to: number) => void,
): HTMLDivElement {
  const handle = document.createElement('div')
  handle.className = className
  handle.dataset.index = String(index)
  let start: { id: number; x: number; y: number } | null = null
  let target: HTMLElement | undefined

  const handleAt = (event: PointerEvent) => document.elementsFromPoint(event.clientX, event.clientY)
    .find((element): element is HTMLElement =>
      element instanceof HTMLElement && element.parentElement === overlay && element.classList.contains(className))

  const clear = () => {
    start = null
    handle.classList.remove('te-dragging')
    target?.classList.remove('te-drop-target')
    target = undefined
  }

  handle.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return
    event.preventDefault()
    handle.setPointerCapture(event.pointerId)
    start = { id: event.pointerId, x: event.clientX, y: event.clientY }
  })
  handle.addEventListener('pointermove', (event) => {
    if (start?.id !== event.pointerId) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5 &&
        !handle.classList.contains('te-dragging')) return
    handle.classList.add('te-dragging')
    const next = handleAt(event)
    target?.classList.remove('te-drop-target')
    target = next === handle ? undefined : next
    target?.classList.add('te-drop-target')
  })
  handle.addEventListener('pointerup', (event) => {
    if (start?.id !== event.pointerId) return
    const to = handle.classList.contains('te-dragging') ? handleAt(event)?.dataset.index : undefined
    clear()
    if (to !== undefined && Number(to) !== index) onMove(index, Number(to))
  })
  handle.addEventListener('pointercancel', clear)
  handle.addEventListener('lostpointercapture', clear)
  return handle
}

function showEditUI(view: EditorView, pos: number) {
  hideAll()

  if (view.isDestroyed) return

  const livePos = tableEditPluginKey.getState(view.state) ?? pos
  const tableNode = view.state.doc.nodeAt(livePos)
  if (!tableNode || tableNode.type.name !== 'table') return

  const tableDom = view.nodeDOM(livePos) as HTMLElement
  if (!tableDom) return
  const table = (tableDom.tagName === 'TABLE' ? tableDom : tableDom.querySelector('table')) as HTMLTableElement | null
  if (!table || !table.rows || table.rows.length === 0) return

  const rect = table.getBoundingClientRect()
  const cols = (table.rows[0]?.cells.length) || 0
  const rows = table.rows.length
  const locale = document.documentElement.lang === 'ru' ? 'ru' : 'en'
  const t = (key: TranslationKey) => getTranslation(locale, key)

  const overlay = document.createElement('div')
  overlay.className = 'table-edit-overlay'
  overlay.style.cssText = `position:fixed;pointer-events:none;z-index:20;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;`
  currentOverlay = overlay

  // The table handles use pointer capture rather than the browser's file drag loop.
  for (let i = 0; i < cols; i++) {
    const cell = table.rows[0].cells[i]
    if (!cell) continue
    const cr = cell.getBoundingClientRect()
    const el = makeDragHandle(overlay, 'te-col-drag', i, (from, to) => moveColumnAt(view, pos, from, to))
    el.title = t('editor.table.edit.moveColumn')
    el.style.cssText = `position:absolute;left:${cr.left - rect.left}px;top:0;width:${cr.width}px;height:${cr.height}px;pointer-events:auto;z-index:2;`
    overlay.appendChild(el)
  }

  // The header row stays fixed.
  for (let i = 1; i < rows; i++) {
    const cell = table.rows[i]?.cells[0]
    if (!cell) continue
    const cr = cell.getBoundingClientRect()
    const el = makeDragHandle(overlay, 'te-row-drag', i, (from, to) => moveRowAt(view, pos, from, to))
    el.title = t('editor.table.edit.moveRow')
    el.style.cssText = `position:absolute;top:${cr.top - rect.top}px;left:0;width:${cr.width}px;height:${cr.height}px;pointer-events:auto;z-index:2;`
    overlay.appendChild(el)
  }

  // Delete column buttons
  for (let i = 0; i < cols; i++) {
    const cell = table.rows[0].cells[i]
    if (!cell) continue
    const cr = cell.getBoundingClientRect()
    const b = makeControl('te-col-del', '×', t('editor.table.edit.deleteColumn'))
    b.style.cssText = `position:absolute;left:${cr.left - rect.left}px;top:-20px;width:${cr.width}px;height:18px;z-index:3;pointer-events:auto;`
    const idx = i
    b.addEventListener('click', (e) => { e.stopPropagation(); deleteColumnAt(view, pos, idx) })
    overlay.appendChild(b)
  }

  // Delete row buttons
  for (let i = 0; i < rows; i++) {
    const cell = table.rows[i]?.cells[0]
    if (!cell) continue
    const cr = cell.getBoundingClientRect()
    const b = makeControl('te-row-del', '×', t('editor.table.edit.deleteRow'))
    b.style.cssText = `position:absolute;top:${cr.top - rect.top}px;left:-20px;width:18px;height:${cr.height}px;z-index:3;pointer-events:auto;`
    const idx = i
    b.addEventListener('click', (e) => { e.stopPropagation(); deleteRowAt(view, pos, idx) })
    overlay.appendChild(b)
  }

  // Add column button BEFORE column 0 (at left border)
  if (cols > 0 && table.rows[0]?.cells[0]) {
    const firstCell = table.rows[0].cells[0]
    const cr = firstCell.getBoundingClientRect()
    const b = makeControl('te-col-add', '+', t('editor.table.edit.addColumnBefore'))
    b.style.cssText = `position:absolute;left:${cr.left - rect.left - 9}px;top:2px;z-index:3;pointer-events:auto;`
    b.addEventListener('click', (e) => { e.stopPropagation(); addColumnBeforeAt(view, pos, 0) })
    overlay.appendChild(b)
  }

  // Add column buttons AFTER each column i (at right border of cell i)
  for (let i = 0; i < cols; i++) {
    const cell = table.rows[0]?.cells[i]
    if (!cell) continue
    const cr = cell.getBoundingClientRect()
    const cx = (i === cols - 1)
      ? cr.right - rect.left + 3
      : cr.right - rect.left - 9
    const b = makeControl('te-col-add', '+', t('editor.table.edit.addColumnAfter'))
    b.style.cssText = `position:absolute;left:${cx}px;top:2px;z-index:3;pointer-events:auto;`
    const idx = i
    b.addEventListener('click', (e) => { e.stopPropagation(); addColumnAfterAt(view, pos, idx) })
    overlay.appendChild(b)
  }

  // Add row button BEFORE row 0 (above row 0)
  if (rows > 0 && table.rows[0]?.cells[0]) {
    const firstRowCell = table.rows[0].cells[0]
    const cr = firstRowCell.getBoundingClientRect()
    const b = makeControl('te-row-add', '+', t('editor.table.edit.addRowBefore'))
    b.style.cssText = `position:absolute;left:2px;top:${cr.top - rect.top - 9}px;z-index:3;pointer-events:auto;`
    b.addEventListener('click', (e) => { e.stopPropagation(); addRowBeforeAt(view, pos, 0) })
    overlay.appendChild(b)
  }

  // Add row buttons AFTER each row i (below row i)
  for (let i = 0; i < rows; i++) {
    const rowCell = table.rows[i]?.cells[0]
    if (!rowCell) continue
    const cr = rowCell.getBoundingClientRect()
    const cy = (i === rows - 1)
      ? cr.bottom - rect.top + 3
      : cr.bottom - rect.top - 9
    const b = makeControl('te-row-add', '+', t('editor.table.edit.addRowAfter'))
    b.style.cssText = `position:absolute;left:2px;top:${cy}px;z-index:3;pointer-events:auto;`
    const idx = i
    b.addEventListener('click', (e) => { e.stopPropagation(); addRowAfterAt(view, pos, idx) })
    overlay.appendChild(b)
  }

  document.body.appendChild(overlay)

  const title = t('editor.table.edit.done')
  const done = makeControl('te-done-btn', title, title)
  done.addEventListener('click', (e) => {
    e.stopPropagation()
    view.dispatch(view.state.tr.setMeta(tableEditPluginKey, null))
    view.focus()
  })
  document.body.appendChild(done)
  doneBtn = done
  updateOverlayPosition(view, pos)

  // Attach scroll & resize listeners to track live table position
  scrollListener = () => updateOverlayPosition(view, pos)
  resizeListener = () => updateOverlayPosition(view, pos)
  window.addEventListener('scroll', scrollListener, true)
  window.addEventListener('resize', resizeListener)
}

function addColumnBeforeAt(view: EditorView, pos: number, colIdx: number) {
  try {
    const livePos = tableEditPluginKey.getState(view.state) ?? pos
    const table = view.state.doc.nodeAt(livePos)
    if (!table || table.type.name !== 'table') return
    const map = TableMap.get(table)
    const targetCol = Math.min(Math.max(0, colIdx), map.width - 1)
    const cellPos = livePos + map.map[targetCol] + 1
    const tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(cellPos + 1)))
    view.dispatch(tr)
    addColumnBefore(view.state, view.dispatch)
    view.focus()
  } catch (err) {
    console.error('Error adding table column before:', err)
  }
}

function addColumnAfterAt(view: EditorView, pos: number, colIdx: number) {
  try {
    const livePos = tableEditPluginKey.getState(view.state) ?? pos
    const table = view.state.doc.nodeAt(livePos)
    if (!table || table.type.name !== 'table') return
    const map = TableMap.get(table)
    const targetCol = Math.min(Math.max(0, colIdx), map.width - 1)
    const cellPos = livePos + map.map[targetCol] + 1
    const tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(cellPos + 1)))
    view.dispatch(tr)
    addColumnAfter(view.state, view.dispatch)
    view.focus()
  } catch (err) {
    console.error('Error adding table column after:', err)
  }
}

function addRowBeforeAt(view: EditorView, pos: number, rowIdx: number) {
  try {
    const livePos = tableEditPluginKey.getState(view.state) ?? pos
    const table = view.state.doc.nodeAt(livePos)
    if (!table || table.type.name !== 'table') return
    const map = TableMap.get(table)
    const targetRow = Math.min(Math.max(0, rowIdx), map.height - 1)
    const cellPos = livePos + map.map[targetRow * map.width] + 1
    const tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(cellPos + 1)))
    view.dispatch(tr)
    addRowBefore(view.state, view.dispatch)
    view.focus()
  } catch (err) {
    console.error('Error adding table row before:', err)
  }
}

function addRowAfterAt(view: EditorView, pos: number, rowIdx: number) {
  try {
    const livePos = tableEditPluginKey.getState(view.state) ?? pos
    const table = view.state.doc.nodeAt(livePos)
    if (!table || table.type.name !== 'table') return
    const map = TableMap.get(table)
    const targetRow = Math.min(Math.max(0, rowIdx), map.height - 1)
    const cellPos = livePos + map.map[targetRow * map.width] + 1
    const tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(cellPos + 1)))
    view.dispatch(tr)
    addRowAfter(view.state, view.dispatch)
    view.focus()
  } catch (err) {
    console.error('Error adding table row after:', err)
  }
}

function deleteColumnAt(view: EditorView, pos: number, colIdx: number) {
  try {
    const livePos = tableEditPluginKey.getState(view.state) ?? pos
    const table = view.state.doc.nodeAt(livePos)
    if (!table || table.type.name !== 'table') return
    const map = TableMap.get(table)
    if (map.width <= 1) return
    const safeColIdx = Math.min(Math.max(0, colIdx), map.width - 1)
    const cellPos = livePos + map.map[safeColIdx] + 1
    const tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(cellPos + 1)))
    view.dispatch(tr)
    deleteColumn(view.state, view.dispatch)
    view.focus()
  } catch (err) {
    console.error('Error deleting table column:', err)
  }
}

function deleteRowAt(view: EditorView, pos: number, rowIdx: number) {
  try {
    const livePos = tableEditPluginKey.getState(view.state) ?? pos
    const table = view.state.doc.nodeAt(livePos)
    if (!table || table.type.name !== 'table') return
    const map = TableMap.get(table)
    if (map.height <= 1) return
    const safeRowIdx = Math.min(Math.max(0, rowIdx), map.height - 1)
    const cellPos = livePos + map.map[safeRowIdx * map.width] + 1
    const tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(cellPos + 1)))
    view.dispatch(tr)
    deleteRow(view.state, view.dispatch)
    view.focus()
  } catch (err) {
    console.error('Error deleting table row:', err)
  }
}

function moveColumnAt(view: EditorView, pos: number, from: number, to: number) {
  try {
    const livePos = tableEditPluginKey.getState(view.state) ?? pos
    const table = view.state.doc.nodeAt(livePos)
    if (!table || table.type.name !== 'table') return
    const map = TableMap.get(table)
    if (from < 0 || from >= map.width || to < 0 || to >= map.width || from === to) return
    const safeFromCol = Math.min(Math.max(0, from), map.width - 1)
    const cellPos = livePos + map.map[safeFromCol] + 1
    const tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(cellPos + 1)))
    view.dispatch(tr)
    moveTableColumn({ from, to, pos: livePos + 1, select: false })(view.state, view.dispatch)
    const updatedPos = tableEditPluginKey.getState(view.state) ?? livePos
    const updatedTable = view.state.doc.nodeAt(updatedPos)
    if (updatedTable && updatedTable.type.name === 'table') {
      const updatedMap = TableMap.get(updatedTable)
      const targetCol = Math.min(Math.max(0, to), updatedMap.width - 1)
      const newCellPos = updatedPos + updatedMap.map[targetCol] + 1
      const selTr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(newCellPos + 1)))
      view.dispatch(selTr)
    }
    view.focus()
  } catch (err) {
    console.error('Error moving table column:', err)
  }
}

function moveRowAt(view: EditorView, pos: number, from: number, to: number) {
  try {
    const livePos = tableEditPluginKey.getState(view.state) ?? pos
    const table = view.state.doc.nodeAt(livePos)
    if (!table || table.type.name !== 'table') return
    const map = TableMap.get(table)
    if (from < 0 || from >= map.height || to < 0 || to >= map.height || from === to) return
    const safeFromRow = Math.min(Math.max(0, from), map.height - 1)
    const cellPos = livePos + map.map[safeFromRow * map.width] + 1
    const tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(cellPos + 1)))
    view.dispatch(tr)
    moveTableRow({ from, to, pos: livePos + 1, select: false })(view.state, view.dispatch)
    const updatedPos = tableEditPluginKey.getState(view.state) ?? livePos
    const updatedTable = view.state.doc.nodeAt(updatedPos)
    if (updatedTable && updatedTable.type.name === 'table') {
      const updatedMap = TableMap.get(updatedTable)
      const targetRow = Math.min(Math.max(0, to), updatedMap.height - 1)
      const newCellPos = updatedPos + updatedMap.map[targetRow * updatedMap.width] + 1
      const selTr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(newCellPos + 1)))
      view.dispatch(selTr)
    }
    view.focus()
  } catch (err) {
    console.error('Error moving table row:', err)
  }
}

export function tableEditPlugin(): Plugin {
  return new Plugin<number | null>({
    key: tableEditPluginKey,
    state: {
      init() { return null },
      apply(tr, prev) {
        const meta = tr.getMeta(tableEditPluginKey)
        if (meta !== undefined) {
          if (typeof meta === 'number' || meta === null) return meta
          if (typeof meta === 'object' && meta && 'openAt' in meta) {
            return (meta as { openAt: number }).openAt
          }
          return null
        }
        if (prev !== null) {
          const mapped = tr.mapping.map(prev, -1)
          if (mapped >= 0 && mapped < tr.doc.content.size) {
            const node = tr.doc.nodeAt(mapped)
            if (node && node.type.name === 'table') {
              return mapped
            }
            const $pos = tr.doc.resolve(Math.min(mapped + 1, tr.doc.content.size))
            for (let d = $pos.depth; d >= 0; d--) {
              if ($pos.node(d).type.name === 'table') {
                return $pos.before(d)
              }
            }
          }
          return prev
        }
        return null
      },
    },
    view() {
      return {
        update(view, prevState) {
          const editPos = tableEditPluginKey.getState(view.state)
          const prevPos = tableEditPluginKey.getState(prevState)
          if (editPos !== prevPos) {
            hideAll()
            if (editPos != null) {
              requestAnimationFrame(() => {
                if (!view.isDestroyed) {
                  const currentPos = tableEditPluginKey.getState(view.state)
                  if (currentPos != null) showEditUI(view, currentPos)
                }
              })
            }
          } else if (editPos != null && !view.state.doc.eq(prevState.doc)) {
            hideAll()
            requestAnimationFrame(() => {
              if (!view.isDestroyed) {
                const currentPos = tableEditPluginKey.getState(view.state)
                if (currentPos != null) showEditUI(view, currentPos)
              }
            })
          }
        },
        destroy() {
          hideAll()
        },
      }
    },
    props: {
      handleDOMEvents: {
        beforeinput(view, event) {
          if (!view.editable || !event.cancelable || event.isComposing) return false
          const { inputType, data } = event
          const keyboardNewline = inputType === 'insertText' && /^(?:\r\n|\r|\n)$/.test(data ?? '')
          if (inputType !== 'insertParagraph' && inputType !== 'insertLineBreak' && !keyboardNewline) return false
          if (!tableEnterNav(view.state, view.dispatch)) return false
          event.preventDefault()
          return true
        },
        keydown(view, event) {
          const editPos = tableEditPluginKey.getState(view.state)
          if (editPos != null) {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              view.dispatch(view.state.tr.setMeta(tableEditPluginKey, null))
              return true
            }
          }
          return false
        },
        mousedown(view, event) {
          const editPos = tableEditPluginKey.getState(view.state)
          if (editPos == null) return false
          const target = event.target as Node
          if (currentOverlay && currentOverlay.contains(target)) return false
          if (doneBtn && doneBtn.contains(target)) return false
          setTimeout(() => {
            if (!view.isDestroyed) {
              view.dispatch(view.state.tr.setMeta(tableEditPluginKey, null))
            }
          }, 0)
          return false
        },
      },
    },
  })
}
