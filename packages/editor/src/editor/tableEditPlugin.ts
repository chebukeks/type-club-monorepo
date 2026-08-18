import { Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
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
let dragColIdx = -1
let dragRowIdx = -1

function hideAll() {
  if (currentOverlay) { currentOverlay.remove(); currentOverlay = null }
  if (doneBtn) { doneBtn.remove(); doneBtn = null }
  if (scrollListener) { window.removeEventListener('scroll', scrollListener, true); scrollListener = null }
  if (resizeListener) { window.removeEventListener('resize', resizeListener); resizeListener = null }
  dragColIdx = -1
  dragRowIdx = -1
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

  // If table is completely outside the visible editor area, hide overlay
  if (rect.bottom < viewRect.top || rect.top > viewRect.bottom || rect.right < viewRect.left || rect.left > viewRect.right) {
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
    doneBtn.style.left = `${rect.left}px`
    doneBtn.style.top = `${rect.bottom + 6}px`
  }
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

  const overlay = document.createElement('div')
  overlay.className = 'table-edit-overlay'
  overlay.style.cssText = `position:fixed;pointer-events:none;z-index:20;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;`
  currentOverlay = overlay

  // Drag & drop columns
  let pendingColMove: { from: number; to: number } | null = null
  for (let i = 0; i < cols; i++) {
    const cell = table.rows[0].cells[i]
    if (!cell) continue
    const cr = cell.getBoundingClientRect()
    const el = document.createElement('div')
    el.className = 'te-col-drag'
    el.style.cssText = `position:absolute;left:${cr.left - rect.left}px;top:0;width:${cr.width}px;height:${cr.height}px;cursor:grab;pointer-events:auto;z-index:2;`
    el.draggable = true
    const idx = i
    el.addEventListener('dragstart', (e) => {
      dragColIdx = idx
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(idx))
      }
      el.classList.add('te-dragging')
    })
    el.addEventListener('dragover', (e) => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
      if (dragColIdx >= 0 && dragColIdx !== idx) el.classList.add('te-drop-target')
    })
    el.addEventListener('dragleave', () => el.classList.remove('te-drop-target'))
    el.addEventListener('drop', (e) => {
      e.preventDefault()
      el.classList.remove('te-drop-target')
      if (dragColIdx >= 0 && dragColIdx !== idx) {
        pendingColMove = { from: dragColIdx, to: idx }
      }
    })
    el.addEventListener('dragend', () => {
      dragColIdx = -1
      el.classList.remove('te-dragging', 'te-drop-target')
      if (pendingColMove) {
        const { from, to } = pendingColMove
        pendingColMove = null
        setTimeout(() => {
          if (!view.isDestroyed) {
            moveColumnAt(view, pos, from, to)
          }
        }, 0)
      }
    })
    overlay.appendChild(el)
  }

  // Drag & drop rows (skip header row 0)
  let pendingRowMove: { from: number; to: number } | null = null
  for (let i = 1; i < rows; i++) {
    const cell = table.rows[i]?.cells[0]
    if (!cell) continue
    const cr = cell.getBoundingClientRect()
    const el = document.createElement('div')
    el.className = 'te-row-drag'
    el.style.cssText = `position:absolute;top:${cr.top - rect.top}px;left:0;width:${cr.width}px;height:${cr.height}px;cursor:grab;pointer-events:auto;z-index:2;`
    el.draggable = true
    const idx = i
    el.addEventListener('dragstart', (e) => {
      dragRowIdx = idx
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(idx))
      }
      el.classList.add('te-dragging')
    })
    el.addEventListener('dragover', (e) => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
      if (dragRowIdx >= 0 && dragRowIdx !== idx) el.classList.add('te-drop-target')
    })
    el.addEventListener('dragleave', () => el.classList.remove('te-drop-target'))
    el.addEventListener('drop', (e) => {
      e.preventDefault()
      el.classList.remove('te-drop-target')
      if (dragRowIdx >= 0 && dragRowIdx !== idx) {
        pendingRowMove = { from: dragRowIdx, to: idx }
      }
    })
    el.addEventListener('dragend', () => {
      dragRowIdx = -1
      el.classList.remove('te-dragging', 'te-drop-target')
      if (pendingRowMove) {
        const { from, to } = pendingRowMove
        pendingRowMove = null
        setTimeout(() => {
          if (!view.isDestroyed) {
            moveRowAt(view, pos, from, to)
          }
        }, 0)
      }
    })
    overlay.appendChild(el)
  }

  // Delete column buttons
  for (let i = 0; i < cols; i++) {
    const cell = table.rows[0].cells[i]
    if (!cell) continue
    const cr = cell.getBoundingClientRect()
    const b = document.createElement('button')
    b.className = 'te-col-del'
    b.style.cssText = `position:absolute;left:${cr.left - rect.left}px;top:-20px;width:${cr.width}px;height:18px;z-index:3;pointer-events:auto;`
    b.textContent = '×'
    b.title = 'Удалить столбец'
    const idx = i
    b.addEventListener('click', (e) => { e.stopPropagation(); deleteColumnAt(view, pos, idx) })
    overlay.appendChild(b)
  }

  // Delete row buttons
  for (let i = 0; i < rows; i++) {
    const cell = table.rows[i]?.cells[0]
    if (!cell) continue
    const cr = cell.getBoundingClientRect()
    const b = document.createElement('button')
    b.className = 'te-row-del'
    b.style.cssText = `position:absolute;top:${cr.top - rect.top}px;left:-20px;width:18px;height:${cr.height}px;z-index:3;pointer-events:auto;`
    b.textContent = '×'
    b.title = 'Удалить строку'
    const idx = i
    b.addEventListener('click', (e) => { e.stopPropagation(); deleteRowAt(view, pos, idx) })
    overlay.appendChild(b)
  }

  // Add column button BEFORE column 0 (at left border)
  if (cols > 0 && table.rows[0]?.cells[0]) {
    const firstCell = table.rows[0].cells[0]
    const cr = firstCell.getBoundingClientRect()
    const b = document.createElement('button')
    b.className = 'te-col-add'
    b.style.cssText = `position:absolute;left:${cr.left - rect.left - 9}px;top:2px;z-index:3;pointer-events:auto;`
    b.textContent = '+'
    b.title = 'Добавить столбец слева'
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
    const b = document.createElement('button')
    b.className = 'te-col-add'
    b.style.cssText = `position:absolute;left:${cx}px;top:2px;z-index:3;pointer-events:auto;`
    b.textContent = '+'
    b.title = 'Добавить столбец справа'
    const idx = i
    b.addEventListener('click', (e) => { e.stopPropagation(); addColumnAfterAt(view, pos, idx) })
    overlay.appendChild(b)
  }

  // Add row button BEFORE row 0 (above row 0)
  if (rows > 0 && table.rows[0]?.cells[0]) {
    const firstRowCell = table.rows[0].cells[0]
    const cr = firstRowCell.getBoundingClientRect()
    const b = document.createElement('button')
    b.className = 'te-row-add'
    b.style.cssText = `position:absolute;left:2px;top:${cr.top - rect.top - 9}px;z-index:3;pointer-events:auto;`
    b.textContent = '+'
    b.title = 'Добавить строку сверху'
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
    const b = document.createElement('button')
    b.className = 'te-row-add'
    b.style.cssText = `position:absolute;left:2px;top:${cy}px;z-index:3;pointer-events:auto;`
    b.textContent = '+'
    b.title = 'Добавить строку снизу'
    const idx = i
    b.addEventListener('click', (e) => { e.stopPropagation(); addRowAfterAt(view, pos, idx) })
    overlay.appendChild(b)
  }

  document.body.appendChild(overlay)

  const done = document.createElement('button')
  done.className = 'te-done-btn'
  done.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.bottom + 6}px;z-index:20;`
  done.textContent = 'Готово'
  done.addEventListener('click', (e) => {
    e.stopPropagation()
    view.dispatch(view.state.tr.setMeta(tableEditPluginKey, null))
    view.focus()
  })
  document.body.appendChild(done)
  doneBtn = done

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
