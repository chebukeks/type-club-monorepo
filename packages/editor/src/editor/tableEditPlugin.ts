import { Plugin, PluginKey } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import {
  addColumnAfter,
  addRowAfter,
  deleteColumn,
  deleteRow,
  moveTableColumn,
  moveTableRow,
  CellSelection,
  TableMap,
} from 'prosemirror-tables'

export const tableEditPluginKey = new PluginKey<number | null>('tableEditPlugin')

let dragColIdx = -1
let dragRowIdx = -1
let currentOverlay: HTMLElement | null = null
let currentWrapper: HTMLElement | null = null
let doneBtn: HTMLElement | null = null

function hideAll() {
  if (currentOverlay) { currentOverlay.remove(); currentOverlay = null }
  if (doneBtn) { doneBtn.remove(); doneBtn = null }
  if (currentWrapper) { currentWrapper = null }
  dragColIdx = -1
  dragRowIdx = -1
}

function showEditUI(view: EditorView, pos: number) {
  hideAll()

  const tableDom = view.nodeDOM(pos) as HTMLElement
  if (!tableDom) return
  const table = (tableDom.tagName === 'TABLE' ? tableDom : tableDom.querySelector('table')) as HTMLTableElement | null
  if (!table) return

  const wrapper = table.parentElement || table as HTMLElement
  currentWrapper = wrapper

  const rect = table.getBoundingClientRect()
  const wrapperRect = wrapper.getBoundingClientRect()
  const ox = rect.left - wrapperRect.left
  const oy = rect.top - wrapperRect.top
  const cols = (table.rows[0]?.cells.length) || 0
  const rows = table.rows.length

  const overlay = document.createElement('div')
  overlay.className = 'table-edit-overlay'
  overlay.style.cssText = `position:absolute;pointer-events:none;z-index:10;left:${ox}px;top:${oy}px;width:${rect.width}px;height:${rect.height}px;`
  currentOverlay = overlay

  // ── Column drag handles ──
  for (let i = 0; i < cols; i++) {
    const cr = table.rows[0].cells[i].getBoundingClientRect()
    const el = document.createElement('div')
    el.className = 'te-col-drag'
    el.style.cssText = `position:absolute;left:${cr.left - rect.left}px;top:0;width:${cr.width}px;height:${cr.height}px;cursor:grab;pointer-events:auto;z-index:2;`
    el.draggable = true
    const idx = i
    el.addEventListener('dragstart', () => { dragColIdx = idx; el.classList.add('te-dragging') })
    el.addEventListener('dragover', (e) => { e.preventDefault(); if (dragColIdx >= 0 && dragColIdx !== idx) el.classList.add('te-drop-target') })
    el.addEventListener('dragleave', () => el.classList.remove('te-drop-target'))
    el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('te-drop-target'); if (dragColIdx >= 0 && dragColIdx !== idx) { moveTableColumn({ from: dragColIdx, to: idx, pos, select: false })(view.state, view.dispatch); view.focus() } })
    el.addEventListener('dragend', () => { dragColIdx = -1; el.classList.remove('te-dragging', 'te-drop-target') })
    overlay.appendChild(el)
  }

  // ── Row drag handles ──
  for (let i = 0; i < rows; i++) {
    const cr = table.rows[i].cells[0].getBoundingClientRect()
    const el = document.createElement('div')
    el.className = 'te-row-drag'
    el.style.cssText = `position:absolute;top:${cr.top - rect.top}px;left:0;width:${cr.width}px;height:${cr.height}px;cursor:grab;pointer-events:auto;z-index:2;`
    el.draggable = true
    const idx = i
    el.addEventListener('dragstart', () => { dragRowIdx = idx; el.classList.add('te-dragging') })
    el.addEventListener('dragover', (e) => { e.preventDefault(); if (dragRowIdx >= 0 && dragRowIdx !== idx) el.classList.add('te-drop-target') })
    el.addEventListener('dragleave', () => el.classList.remove('te-drop-target'))
    el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('te-drop-target'); if (dragRowIdx >= 0 && dragRowIdx !== idx) { moveTableRow({ from: dragRowIdx, to: idx, pos, select: false })(view.state, view.dispatch); view.focus() } })
    el.addEventListener('dragend', () => { dragRowIdx = -1; el.classList.remove('te-dragging', 'te-drop-target') })
    overlay.appendChild(el)
  }

  // ── Column × buttons ──
  for (let i = 0; i < cols; i++) {
    const cr = table.rows[0].cells[i].getBoundingClientRect()
    const b = document.createElement('button')
    b.className = 'te-col-del'
    b.style.cssText = `position:absolute;left:${cr.left - rect.left}px;top:-28px;width:${cr.width}px;height:20px;z-index:3;pointer-events:auto;`
    b.textContent = '×'
    b.title = 'Удалить столбец'
    const idx = i
    b.addEventListener('click', (e) => { e.stopPropagation(); deleteColumnAt(view, pos, idx) })
    overlay.appendChild(b)
  }

  // ── Row × buttons ──
  for (let i = 0; i < rows; i++) {
    const cr = table.rows[i].cells[0].getBoundingClientRect()
    const b = document.createElement('button')
    b.className = 'te-row-del'
    b.style.cssText = `position:absolute;top:${cr.top - rect.top}px;left:-28px;width:20px;height:${cr.height}px;z-index:3;pointer-events:auto;`
    b.textContent = '×'
    b.title = 'Удалить строку'
    const idx = i
    b.addEventListener('click', (e) => { e.stopPropagation(); deleteRowAt(view, pos, idx) })
    overlay.appendChild(b)
  }

  // ── Column + buttons ──
  for (let i = 0; i <= cols; i++) {
    const cx = i < cols
      ? (i === cols - 1 ? table.rows[0].cells[i].getBoundingClientRect().right - rect.left + 3
        : table.rows[0].cells[i].getBoundingClientRect().right - rect.left - 9)
      : table.rows[0].cells[cols - 1].getBoundingClientRect().right - rect.left + 3
    const b = document.createElement('button')
    b.className = 'te-col-add'
    b.style.cssText = `position:absolute;left:${cx}px;top:2px;z-index:3;pointer-events:auto;`
    b.textContent = '+'
    b.title = 'Добавить столбец'
    const idx = i
    b.addEventListener('click', (e) => { e.stopPropagation(); addColumnAt(view, pos, idx, cols) })
    overlay.appendChild(b)
  }

  // ── Row + buttons ──
  for (let i = 0; i <= rows; i++) {
    const cy = i < rows
      ? table.rows[i].getBoundingClientRect().bottom - rect.top - 9
      : table.rows[rows - 1].getBoundingClientRect().bottom - rect.top + 3
    const b = document.createElement('button')
    b.className = 'te-row-add'
    b.style.cssText = `position:absolute;left:2px;top:${cy}px;z-index:3;pointer-events:auto;`
    b.textContent = '+'
    b.title = 'Добавить строку'
    const idx = i
    b.addEventListener('click', (e) => { e.stopPropagation(); addRowAt(view, pos, idx, rows) })
    overlay.appendChild(b)
  }

  wrapper.style.position = 'relative'
  wrapper.appendChild(overlay)

  // ── Done button ──
  const done = document.createElement('button')
  done.className = 'te-done-btn'
  done.style.cssText = `position:absolute;left:${ox}px;top:${oy + rect.height + 8}px;z-index:4;`
  done.textContent = 'Готово'
  done.addEventListener('click', (e) => {
    e.stopPropagation()
    view.dispatch(view.state.tr.setMeta(tableEditPluginKey, null))
    view.focus()
  })
  wrapper.appendChild(done)
  doneBtn = done
}

// ── Table mutation helpers ──

function addColumnAt(view: EditorView, pos: number, colIdx: number, totalCols: number) {
  const table = view.state.doc.nodeAt(pos)
  if (!table || table.type.name !== 'table') return
  const map = TableMap.get(table)
  const cellPos = pos + map.map[Math.min(colIdx, totalCols - 1)] + 1
  const $cell = view.state.doc.resolve(cellPos)
  const sel = CellSelection.colSelection($cell)
  if (sel) { view.dispatch(view.state.tr.setSelection(sel)); addColumnAfter(view.state, view.dispatch) }
  view.focus()
}

function addRowAt(view: EditorView, pos: number, rowIdx: number, totalRows: number) {
  const table = view.state.doc.nodeAt(pos)
  if (!table || table.type.name !== 'table') return
  const map = TableMap.get(table)
  const cellPos = pos + map.map[Math.min(rowIdx, totalRows - 1) * map.width] + 1
  const $cell = view.state.doc.resolve(cellPos)
  const sel = CellSelection.rowSelection($cell)
  if (sel) { view.dispatch(view.state.tr.setSelection(sel)); addRowAfter(view.state, view.dispatch) }
  view.focus()
}

function deleteColumnAt(view: EditorView, pos: number, colIdx: number) {
  const table = view.state.doc.nodeAt(pos)
  if (!table || table.type.name !== 'table') return
  const map = TableMap.get(table)
  if (map.width <= 1) return
  const cellPos = pos + map.map[colIdx] + 1
  const $cell = view.state.doc.resolve(cellPos)
  const sel = CellSelection.colSelection($cell)
  if (sel) { view.dispatch(view.state.tr.setSelection(sel)); deleteColumn(view.state, view.dispatch) }
  view.focus()
}

function deleteRowAt(view: EditorView, pos: number, rowIdx: number) {
  const table = view.state.doc.nodeAt(pos)
  if (!table || table.type.name !== 'table') return
  const map = TableMap.get(table)
  if (map.height <= 1) return
  const cellPos = pos + map.map[rowIdx * map.width] + 1
  const $cell = view.state.doc.resolve(cellPos)
  const sel = CellSelection.rowSelection($cell)
  if (sel) { view.dispatch(view.state.tr.setSelection(sel)); deleteRow(view.state, view.dispatch) }
  view.focus()
}

// ── Plugin ──

export function tableEditPlugin(): Plugin {
  return new Plugin<number | null>({
    key: tableEditPluginKey,
    state: {
      init() { return null },
      apply(tr, prev) {
        const meta = tr.getMeta(tableEditPluginKey)
        if (meta !== undefined) return meta
        return prev
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
              requestAnimationFrame(() => showEditUI(view, editPos))
            }
          } else if (editPos != null && !view.state.doc.eq(prevState.doc)) {
            hideAll()
            requestAnimationFrame(() => showEditUI(view, editPos))
          }
        },
        destroy() { hideAll() },
      }
    },
    props: {
      handleDOMEvents: {
        keydown(view, event) {
          const editPos = tableEditPluginKey.getState(view.state)
          if (editPos != null) {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              view.dispatch(view.state.tr.setMeta(tableEditPluginKey, null))
              return true
            }
            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) return true
            if (event.key === 'Backspace' || event.key === 'Delete' || event.key === 'Enter') return true
            return true
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
