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
let currentTablePos: number | null = null

function hideOverlay() {
  if (currentOverlay) {
    currentOverlay.remove()
    currentOverlay = null
  }
  currentTablePos = null
  dragColIdx = -1
  dragRowIdx = -1
}

function showOverlay(view: EditorView, pos: number) {
  hideOverlay()

  const tableDom = view.nodeDOM(pos) as HTMLElement
  if (!tableDom) return
  const table = (tableDom.tagName === 'TABLE' ? tableDom : tableDom.querySelector('table')) as HTMLTableElement | null
  if (!table) return

  currentTablePos = pos
  const wrapper = table.parentElement || table as HTMLElement

  // Make table non-editable during edit mode
  table.setAttribute('contenteditable', 'false')

  const overlay = document.createElement('div')
  overlay.className = 'table-edit-overlay'
  overlay.style.cssText = 'position:absolute;pointer-events:none;z-index:10;'
  currentOverlay = overlay

  const rect = table.getBoundingClientRect()
  const wrapperRect = wrapper.getBoundingClientRect()
  overlay.style.left = `${rect.left - wrapperRect.left}px`
  overlay.style.top = `${rect.top - wrapperRect.top}px`
  overlay.style.width = `${rect.width}px`
  overlay.style.height = `${rect.height}px`

  const cols = (table.rows[0]?.cells.length) || 0
  const rows = table.rows.length

  // Column drag handles
  for (let i = 0; i < cols; i++) {
    const cellRect = table.rows[0].cells[i].getBoundingClientRect()
    const h = document.createElement('div')
    h.className = 'te-col-drag'
    h.style.cssText = `position:absolute;left:${cellRect.left - rect.left}px;top:-22px;width:${cellRect.width}px;height:20px;cursor:grab;pointer-events:auto;border-radius:4px;background:transparent;z-index:2;`
    h.draggable = true
    const idx = i
    h.addEventListener('dragstart', (e) => {
      dragColIdx = idx
      h.classList.add('te-dragging')
      e.dataTransfer!.effectAllowed = 'move'
    })
    h.addEventListener('dragover', (e) => {
      e.preventDefault()
      if (dragColIdx >= 0 && dragColIdx !== idx) h.classList.add('te-drop-target')
    })
    h.addEventListener('dragleave', () => h.classList.remove('te-drop-target'))
    h.addEventListener('drop', (e) => {
      e.preventDefault()
      h.classList.remove('te-drop-target')
      if (dragColIdx < 0 || dragColIdx === idx) return
      moveTableColumn({ from: dragColIdx, to: idx, pos, select: false })(view.state, view.dispatch)
      view.focus()
    })
    h.addEventListener('dragend', () => { dragColIdx = -1; h.classList.remove('te-dragging', 'te-drop-target') })
    overlay.appendChild(h)
  }

  // Row drag handles
  for (let i = 0; i < rows; i++) {
    const cellRect = table.rows[i].cells[0].getBoundingClientRect()
    const h = document.createElement('div')
    h.className = 'te-row-drag'
    h.style.cssText = `position:absolute;top:${cellRect.top - rect.top}px;left:-28px;width:20px;height:${cellRect.height}px;cursor:grab;pointer-events:auto;border-radius:4px;background:transparent;z-index:2;`
    h.draggable = true
    const idx = i
    h.addEventListener('dragstart', (e) => {
      dragRowIdx = idx
      h.classList.add('te-dragging')
      e.dataTransfer!.effectAllowed = 'move'
    })
    h.addEventListener('dragover', (e) => {
      e.preventDefault()
      if (dragRowIdx >= 0 && dragRowIdx !== idx) h.classList.add('te-drop-target')
    })
    h.addEventListener('dragleave', () => h.classList.remove('te-drop-target'))
    h.addEventListener('drop', (e) => {
      e.preventDefault()
      h.classList.remove('te-drop-target')
      if (dragRowIdx < 0 || dragRowIdx === idx) return
      moveTableRow({ from: dragRowIdx, to: idx, pos, select: false })(view.state, view.dispatch)
      view.focus()
    })
    h.addEventListener('dragend', () => { dragRowIdx = -1; h.classList.remove('te-dragging', 'te-drop-target') })
    overlay.appendChild(h)
  }

  // Column delete buttons
  for (let i = 0; i < cols; i++) {
    const cellRect = table.rows[0].cells[i].getBoundingClientRect()
    const b = document.createElement('button')
    b.className = 'te-col-del'
    b.style.cssText = `position:absolute;left:${cellRect.left - rect.left}px;top:-40px;width:${cellRect.width}px;height:16px;border:none;border-radius:3px;background:transparent;color:var(--text-dim);font-size:12px;cursor:pointer;pointer-events:auto;z-index:3;`
    b.textContent = '×'
    const idx = i
    b.addEventListener('click', (e) => {
      e.stopPropagation()
      deleteColumnAt(view, pos, idx)
    })
    overlay.appendChild(b)
  }

  // Row delete buttons
  for (let i = 0; i < rows; i++) {
    const cellRect = table.rows[i].cells[0].getBoundingClientRect()
    const b = document.createElement('button')
    b.className = 'te-row-del'
    b.style.cssText = `position:absolute;top:${cellRect.top - rect.top}px;left:-40px;width:16px;height:${cellRect.height}px;border:none;border-radius:3px;background:transparent;color:var(--text-dim);font-size:12px;cursor:pointer;pointer-events:auto;z-index:3;`
    b.textContent = '×'
    const idx = i
    b.addEventListener('click', (e) => {
      e.stopPropagation()
      deleteRowAt(view, pos, idx)
    })
    overlay.appendChild(b)
  }

  // Column add buttons
  for (let i = 0; i <= cols; i++) {
    const cx = i < cols
      ? (i === cols - 1 ? table.rows[0].cells[i].getBoundingClientRect().right - rect.left + 2
        : table.rows[0].cells[i].getBoundingClientRect().right - rect.left - 9)
      : table.rows[0].cells[cols - 1].getBoundingClientRect().right - rect.left + 2
    const b = document.createElement('button')
    b.className = 'te-col-add'
    b.style.cssText = `position:absolute;left:${cx}px;top:4px;width:18px;height:18px;border:none;border-radius:50%;background:var(--accent);color:#fff;font-size:13px;font-weight:bold;cursor:pointer;pointer-events:auto;z-index:3;opacity:0;`
    b.textContent = '+'
    b.title = 'Добавить столбец'
    const idx = i
    b.addEventListener('click', (e) => {
      e.stopPropagation()
      addColumnAt(view, pos, idx, cols)
    })
    overlay.appendChild(b)
  }

  // Row add buttons
  for (let i = 0; i <= rows; i++) {
    const cy = i < rows
      ? table.rows[i].getBoundingClientRect().bottom - rect.top - 9
      : table.rows[rows - 1].getBoundingClientRect().bottom - rect.top + 2
    const b = document.createElement('button')
    b.className = 'te-row-add'
    b.style.cssText = `position:absolute;left:4px;top:${cy}px;width:18px;height:18px;border:none;border-radius:50%;background:var(--accent);color:#fff;font-size:13px;font-weight:bold;cursor:pointer;pointer-events:auto;z-index:3;opacity:0;`
    b.textContent = '+'
    b.title = 'Добавить строку'
    const idx = i
    b.addEventListener('click', (e) => {
      e.stopPropagation()
      addRowAt(view, pos, idx, rows)
    })
    overlay.appendChild(b)
  }

  // Done button
  const done = document.createElement('button')
  done.className = 'te-done-btn'
  done.style.cssText = `position:absolute;left:50%;top:${rect.height + 6}px;transform:translateX(-50%);padding:4px 16px;border:none;border-radius:6px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;pointer-events:auto;z-index:4;`
  done.textContent = 'Готово'
  done.addEventListener('click', (e) => {
    e.stopPropagation()
    view.dispatch(view.state.tr.setMeta(tableEditPluginKey, null))
    view.focus()
  })
  overlay.appendChild(done)

  wrapper.style.position = 'relative'
  wrapper.appendChild(overlay)
}

function addColumnAt(view: EditorView, pos: number, colIdx: number, totalCols: number) {
  const table = view.state.doc.nodeAt(pos)
  if (!table || table.type.name !== 'table') return
  const map = TableMap.get(table)
  const cellPos = pos + map.map[Math.min(colIdx, totalCols - 1)] + 1
  const $cell = view.state.doc.resolve(cellPos)
  const sel = CellSelection.colSelection($cell)
  if (sel) {
    view.dispatch(view.state.tr.setSelection(sel))
    addColumnAfter(view.state, view.dispatch)
  }
  view.focus()
}

function addRowAt(view: EditorView, pos: number, rowIdx: number, totalRows: number) {
  const table = view.state.doc.nodeAt(pos)
  if (!table || table.type.name !== 'table') return
  const map = TableMap.get(table)
  const cellPos = pos + map.map[Math.min(rowIdx, totalRows - 1) * map.width] + 1
  const $cell = view.state.doc.resolve(cellPos)
  const sel = CellSelection.rowSelection($cell)
  if (sel) {
    view.dispatch(view.state.tr.setSelection(sel))
    addRowAfter(view.state, view.dispatch)
  }
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
  if (sel) {
    view.dispatch(view.state.tr.setSelection(sel))
    deleteColumn(view.state, view.dispatch)
  }
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
  if (sel) {
    view.dispatch(view.state.tr.setSelection(sel))
    deleteRow(view.state, view.dispatch)
  }
  view.focus()
}

export function tableEditPlugin(): Plugin {
  return new Plugin<number | null>({
    key: tableEditPluginKey,
    state: {
      init() { return null },
      apply(tr, prev) {
        const meta = tr.getMeta(tableEditPluginKey)
        if (meta !== undefined) return meta
        if (!tr.docChanged) return prev
        return prev
      },
    },
    view() {
      return {
        update(view, prevState) {
          const editPos = tableEditPluginKey.getState(view.state)
          const prevPos = tableEditPluginKey.getState(prevState)
          if (editPos !== prevPos) {
            hideOverlay()
            if (editPos != null) {
              requestAnimationFrame(() => showOverlay(view, editPos))
            }
          }
          if (editPos != null && view.state.doc.eq(prevState.doc)) {
            // Table structure unchanged — update overlay positions
            requestAnimationFrame(() => {
              if (currentTablePos === editPos) {
                hideOverlay()
                showOverlay(view, editPos)
              }
            })
          }
        },
        destroy() { hideOverlay() },
      }
    },
    props: {
      handleKeyDown(view, event) {
        const editPos = tableEditPluginKey.getState(view.state)
        if (editPos != null) {
          if (event.key === 'Escape') {
            view.dispatch(view.state.tr.setMeta(tableEditPluginKey, null))
          }
          return true
        }
        return false
      },
      handleDOMEvents: {
        mousedown(view, event) {
          const editPos = tableEditPluginKey.getState(view.state)
          if (editPos == null) return false
          const clickPos = view.posAtDOM(event.target as Node, 0)
          const $click = view.state.doc.resolve(clickPos)
          let inside = false
          for (let d = $click.depth; d > 0; d--) {
            if ($click.node(d).type.name === 'table' && $click.before(d) === editPos) {
              inside = true
              break
            }
          }
          if (!inside) {
            setTimeout(() => {
              if (!view.isDestroyed) {
                view.dispatch(view.state.tr.setMeta(tableEditPluginKey, null))
              }
            }, 0)
          }
          return false
        },
      },
    },
  })
}
