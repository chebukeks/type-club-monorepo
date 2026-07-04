import { Node as PMNode } from 'prosemirror-model'
import { EditorView, NodeView } from 'prosemirror-view'
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
import { tableEditPluginKey } from './tableEditPlugin'

export class TableEditNodeView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement
  private view: EditorView
  private getPos: () => number | undefined
  private overlay: HTMLElement | null = null
  private dragColumnIdx = -1
  private dragRowIdx = -1

  constructor(_node: PMNode, view: EditorView, getPos: () => number | undefined) {
    this.view = view
    this.getPos = getPos

    this.dom = document.createElement('div')
    this.dom.className = 'table-edit-wrapper'

    const inner = document.createElement('div')
    inner.className = 'table-edit-inner'
    this.dom.appendChild(inner)
    this.contentDOM = inner

    this.renderOverlay()
  }

  update(_node: PMNode): boolean {
    this.renderOverlay()
    return true
  }

  destroy() {
    this.removeOverlay()
  }

  private renderOverlay() {
    const editPos = tableEditPluginKey.getState(this.view.state)
    const pos = this.getPos()
    const editing = !!(editPos != null && pos != null && editPos === pos)

    if (editing) {
      this.createOverlay()
      this.positionOverlay()
    } else {
      this.removeOverlay()
    }
  }

  private createOverlay() {
    if (this.overlay) return
    this.overlay = document.createElement('div')
    this.overlay.className = 'table-edit-overlay'

    this.buildColumnDragHandles()
    this.buildRowDragHandles()
    this.buildColumnDeleteBtns()
    this.buildRowDeleteBtns()
    this.buildAddButtons()
    this.buildDoneBtn()

    this.dom.appendChild(this.overlay)
  }

  private removeOverlay() {
    if (this.overlay) {
      this.overlay.remove()
      this.overlay = null
    }
  }

  private positionOverlay() {
    if (!this.overlay) return
    const table = this.dom.querySelector('table') as HTMLTableElement
    if (!table) return
    const wrapperRect = this.dom.getBoundingClientRect()
    const tableRect = table.getBoundingClientRect()
    const offsetX = tableRect.left - wrapperRect.left
    const offsetY = tableRect.top - wrapperRect.top
    this.overlay.style.left = `${offsetX}px`
    this.overlay.style.top = `${offsetY}px`
    this.overlay.style.width = `${tableRect.width}px`

    const rows = table.rows
    this.updateColumnHandles(table, offsetX, offsetY)
    this.updateRowHandles(rows, offsetX, offsetY)
    this.updateDeleteBtns(table, rows, offsetX, offsetY)
    this.updateAddButtons(table, rows, offsetY)

    if (this.doneBtnEl) {
      this.doneBtnEl.style.top = `${offsetY + tableRect.height + 6}px`
      this.doneBtnEl.style.left = `${offsetX + tableRect.width / 2}px`
    }
  }

  // ── Column drag handles ──
  private colDragEls: HTMLElement[] = []

  private buildColumnDragHandles() {
    const container = document.createElement('div')
    container.className = 'te-col-drag-container'
    this.overlay!.appendChild(container)
    for (let i = 0; i < 16; i++) {
      const h = document.createElement('div')
      h.className = 'te-col-drag'
      h.draggable = true
      h.addEventListener('dragstart', (e) => this.onColDragStart(e, i))
      h.addEventListener('dragover', (e) => this.onColDragOver(e, i))
      h.addEventListener('dragleave', () => this.onColDragLeave())
      h.addEventListener('drop', (e) => this.onColDrop(e, i))
      h.addEventListener('dragend', () => this.onColDragEnd())
      container.appendChild(h)
      this.colDragEls.push(h)
    }
  }

  private onColDragStart(e: DragEvent, idx: number) {
    this.dragColumnIdx = idx
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', String(idx))
    }
    this.colDragEls[idx].classList.add('te-dragging')
  }

  private onColDragOver(e: DragEvent, idx: number) {
    e.preventDefault()
    if (this.dragColumnIdx < 0) return
    this.colDragEls.forEach((el, i) => {
      el.classList.toggle('te-drop-target', i === idx && i !== this.dragColumnIdx)
    })
  }

  private onColDragLeave() {
    this.colDragEls.forEach(el => el.classList.remove('te-drop-target'))
  }

  private onColDrop(e: DragEvent, toIdx: number) {
    e.preventDefault()
    const fromIdx = this.dragColumnIdx
    if (fromIdx < 0 || fromIdx === toIdx) return
    const pos = this.getPos()
    if (pos == null) return
    moveTableColumn({ from: fromIdx, to: toIdx, pos, select: false })(this.view.state, this.view.dispatch)
    this.view.focus()
    this.onColDragEnd()
  }

  private onColDragEnd() {
    this.dragColumnIdx = -1
    this.colDragEls.forEach(el => {
      el.classList.remove('te-dragging', 'te-drop-target')
    })
  }

  // ── Row drag handles ──
  private rowDragEls: HTMLElement[] = []

  private buildRowDragHandles() {
    const container = document.createElement('div')
    container.className = 'te-row-drag-container'
    this.overlay!.appendChild(container)
    for (let i = 0; i < 32; i++) {
      const h = document.createElement('div')
      h.className = 'te-row-drag'
      h.draggable = true
      h.addEventListener('dragstart', (e) => this.onRowDragStart(e, i))
      h.addEventListener('dragover', (e) => this.onRowDragOver(e, i))
      h.addEventListener('dragleave', () => this.onRowDragLeave())
      h.addEventListener('drop', (e) => this.onRowDrop(e, i))
      h.addEventListener('dragend', () => this.onRowDragEnd())
      container.appendChild(h)
      this.rowDragEls.push(h)
    }
  }

  private onRowDragStart(e: DragEvent, idx: number) {
    this.dragRowIdx = idx
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', String(idx))
    }
    this.rowDragEls[idx].classList.add('te-dragging')
  }

  private onRowDragOver(e: DragEvent, idx: number) {
    e.preventDefault()
    if (this.dragRowIdx < 0) return
    this.rowDragEls.forEach((el, i) => {
      el.classList.toggle('te-drop-target', i === idx && i !== this.dragRowIdx)
    })
  }

  private onRowDragLeave() {
    this.rowDragEls.forEach(el => el.classList.remove('te-drop-target'))
  }

  private onRowDrop(e: DragEvent, toIdx: number) {
    e.preventDefault()
    const fromIdx = this.dragRowIdx
    if (fromIdx < 0 || fromIdx === toIdx) return
    const pos = this.getPos()
    if (pos == null) return
    moveTableRow({ from: fromIdx, to: toIdx, pos, select: false })(this.view.state, this.view.dispatch)
    this.view.focus()
    this.onRowDragEnd()
  }

  private onRowDragEnd() {
    this.dragRowIdx = -1
    this.rowDragEls.forEach(el => {
      el.classList.remove('te-dragging', 'te-drop-target')
    })
  }

  // ── Delete buttons ──
  private colDelEls: HTMLElement[] = []
  private rowDelEls: HTMLElement[] = []
  private colDelContainer: HTMLElement | null = null
  private rowDelContainer: HTMLElement | null = null

  private buildColumnDeleteBtns() {
    this.colDelContainer = document.createElement('div')
    this.colDelContainer.className = 'te-col-del-container'
    this.overlay!.appendChild(this.colDelContainer)
    for (let i = 0; i < 16; i++) {
      const b = document.createElement('button')
      b.className = 'te-col-del'
      b.textContent = '×'
      b.addEventListener('click', (e) => {
        e.stopPropagation()
        this.deleteColumnAt(i)
      })
      this.colDelContainer.appendChild(b)
      this.colDelEls.push(b)
    }
  }

  private buildRowDeleteBtns() {
    this.rowDelContainer = document.createElement('div')
    this.rowDelContainer.className = 'te-row-del-container'
    this.overlay!.appendChild(this.rowDelContainer)
    for (let i = 0; i < 32; i++) {
      const b = document.createElement('button')
      b.className = 'te-row-del'
      b.textContent = '×'
      b.addEventListener('click', (e) => {
        e.stopPropagation()
        this.deleteRowAt(i)
      })
      this.rowDelContainer.appendChild(b)
      this.rowDelEls.push(b)
    }
  }

  private deleteColumnAt(colIdx: number) {
    const pos = this.getPos()
    if (pos == null) return
    const table = this.view.state.doc.nodeAt(pos)
    if (!table || table.type.name !== 'table') return
    const map = TableMap.get(table)
    if (map.width <= 1) return
    const cellPos = pos + map.map[colIdx] + 1
    const $cell = this.view.state.doc.resolve(cellPos)
    const sel = CellSelection.colSelection($cell)
    if (sel) {
      this.view.dispatch(this.view.state.tr.setSelection(sel))
      deleteColumn(this.view.state, this.view.dispatch)
    }
    this.view.focus()
  }

  private deleteRowAt(rowIdx: number) {
    const pos = this.getPos()
    if (pos == null) return
    const table = this.view.state.doc.nodeAt(pos)
    if (!table || table.type.name !== 'table') return
    const map = TableMap.get(table)
    if (map.height <= 1) return
    const cellPos = pos + map.map[rowIdx * map.width] + 1
    const $cell = this.view.state.doc.resolve(cellPos)
    const sel = CellSelection.rowSelection($cell)
    if (sel) {
      this.view.dispatch(this.view.state.tr.setSelection(sel))
      deleteRow(this.view.state, this.view.dispatch)
    }
    this.view.focus()
  }

  // ── Add buttons ──
  private colAddContainer: HTMLElement | null = null
  private rowAddContainer: HTMLElement | null = null

  private buildAddButtons() {
    this.colAddContainer = document.createElement('div')
    this.colAddContainer.className = 'te-col-add-container'
    this.overlay!.appendChild(this.colAddContainer)

    this.rowAddContainer = document.createElement('div')
    this.rowAddContainer.className = 'te-row-add-container'
    this.overlay!.appendChild(this.rowAddContainer)
  }

  // ── Done button ──
  private doneBtnEl: HTMLElement | null = null

  private buildDoneBtn() {
    this.doneBtnEl = document.createElement('button')
    this.doneBtnEl.className = 'te-done-btn'
    this.doneBtnEl.textContent = 'Готово'
    this.doneBtnEl.addEventListener('click', (e) => {
      e.stopPropagation()
      this.view.dispatch(this.view.state.tr.setMeta(tableEditPluginKey, null))
      this.view.focus()
    })
    this.overlay!.appendChild(this.doneBtnEl)
  }

  // ── Position updaters ──

  private updateColumnHandles(table: HTMLTableElement, _offX: number, _offY: number) {
    const cols = table.rows[0]?.cells.length || 0
    this.colDragEls.forEach((el, i) => {
      if (i >= cols) { el.style.display = 'none'; return }
      const th = table.rows[0].cells[i]
      const rect = th.getBoundingClientRect()
      const wrapperR = this.dom.getBoundingClientRect()
      el.style.display = ''
      el.style.left = `${rect.left - wrapperR.left}px`
      el.style.top = `${rect.top - wrapperR.top - 24}px`
      el.style.width = `${rect.width}px`
    })

    if (this.colDelContainer) {
      const row0Rect = table.rows[0].getBoundingClientRect()
      const wrapperR = this.dom.getBoundingClientRect()
      this.colDelContainer.style.top = `${row0Rect.top - wrapperR.top - 40}px`
      this.colDelContainer.style.left = `${_offX}px`
      this.colDelEls.forEach((el, i) => {
        if (i >= cols) { el.style.display = 'none'; return }
        el.style.display = ''
        el.style.left = `${table.rows[0].cells[i].getBoundingClientRect().left - wrapperR.left}px`
        el.style.width = `${table.rows[0].cells[i].getBoundingClientRect().width}px`
      })
    }
  }

  private updateRowHandles(rows: HTMLCollectionOf<HTMLTableRowElement>, offX: number, offY: number) {
    this.rowDragEls.forEach((el, i) => {
      if (i >= rows.length) { el.style.display = 'none'; return }
      const rect = rows[i].getBoundingClientRect()
      const wrapperR = this.dom.getBoundingClientRect()
      el.style.display = ''
      el.style.top = `${rect.top - wrapperR.top}px`
      el.style.left = `${rect.left - wrapperR.left - 28}px`
      el.style.height = `${rect.height}px`
    })

    if (this.rowDelContainer) {
      this.rowDelContainer.style.top = `${offY}px`
      this.rowDelContainer.style.left = `${offX - 40}px`
      this.rowDelEls.forEach((el, i) => {
        if (i >= rows.length) { el.style.display = 'none'; return }
        const rect = rows[i].getBoundingClientRect()
        const wrapperR = this.dom.getBoundingClientRect()
        el.style.display = ''
        el.style.top = `${rect.top - wrapperR.top}px`
        el.style.height = `${rect.height}px`
      })
    }
  }

  private updateDeleteBtns(_table: HTMLTableElement, _rows: HTMLCollectionOf<HTMLTableRowElement>, _offX: number, _offY: number) {
    // Delete buttons positioned inline with updateColumnHandles / updateRowHandles
  }

  private updateAddButtons(table: HTMLTableElement, rows: HTMLCollectionOf<HTMLTableRowElement>, offY: number) {
    if (!this.colAddContainer || !this.rowAddContainer) return
    const wrapperR = this.dom.getBoundingClientRect()
    const cols = table.rows[0]?.cells.length || 0

    this.colAddContainer.innerHTML = ''
    this.colAddContainer.style.top = `${offY}px`

    for (let i = 0; i <= cols; i++) {
      const btn = document.createElement('button')
      btn.className = 'te-col-add'
      btn.textContent = '+'
      btn.title = 'Добавить столбец'
      if (i < cols) {
        const rect = table.rows[0].cells[i].getBoundingClientRect()
        btn.style.position = 'absolute'
        if (i === cols - 1) {
          btn.style.left = `${rect.right - wrapperR.left + 2}px`
        } else {
          btn.style.left = `${rect.right - wrapperR.left - 9}px`
        }
      } else {
        const lastRect = table.rows[0].cells[cols - 1].getBoundingClientRect()
        btn.style.position = 'absolute'
        btn.style.left = `${lastRect.right - wrapperR.left + 2}px`
      }
      btn.style.top = '4px'
      const colIdx = i
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.addColumnAt(colIdx)
      })
      this.colAddContainer.appendChild(btn)
    }

    this.rowAddContainer.innerHTML = ''
    this.rowAddContainer.style.left = '0'

    for (let i = 0; i <= rows.length; i++) {
      const btn = document.createElement('button')
      btn.className = 'te-row-add'
      btn.textContent = '+'
      btn.title = 'Добавить строку'
      if (i < rows.length) {
        const rect = rows[i].getBoundingClientRect()
        btn.style.position = 'absolute'
        btn.style.top = `${rect.bottom - wrapperR.top - 9}px`
      } else {
        const lastRect = rows[rows.length - 1].getBoundingClientRect()
        btn.style.position = 'absolute'
        btn.style.top = `${lastRect.bottom - wrapperR.top + 2}px`
      }
      const rowIdx = i
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.addRowAt(rowIdx)
      })
      this.rowAddContainer.appendChild(btn)
    }
  }

  private addColumnAt(colIdx: number) {
    const pos = this.getPos()
    if (pos == null) return
    const table = this.view.state.doc.nodeAt(pos)
    if (!table || table.type.name !== 'table') return
    const map = TableMap.get(table)

    if (map.width > colIdx) {
      const cellPos = pos + map.map[colIdx] + 1
      const $cell = this.view.state.doc.resolve(cellPos)
      const sel = CellSelection.colSelection($cell)
      if (sel) {
        this.view.dispatch(this.view.state.tr.setSelection(sel))
        addColumnAfter(this.view.state, this.view.dispatch)
      }
    } else {
      const lastCellPos = pos + map.map[map.width - 1] + 1
      const $cell = this.view.state.doc.resolve(lastCellPos)
      const sel = CellSelection.colSelection($cell)
      if (sel) {
        this.view.dispatch(this.view.state.tr.setSelection(sel))
        addColumnAfter(this.view.state, this.view.dispatch)
      }
    }
    this.view.focus()
  }

  private addRowAt(rowIdx: number) {
    const pos = this.getPos()
    if (pos == null) return
    const table = this.view.state.doc.nodeAt(pos)
    if (!table || table.type.name !== 'table') return
    const map = TableMap.get(table)

    if (map.height > rowIdx) {
      const cellPos = pos + map.map[rowIdx * map.width] + 1
      const $cell = this.view.state.doc.resolve(cellPos)
      const sel = CellSelection.rowSelection($cell)
      if (sel) {
        this.view.dispatch(this.view.state.tr.setSelection(sel))
        addRowAfter(this.view.state, this.view.dispatch)
      }
    } else {
      const lastCellPos = pos + map.map[(map.height - 1) * map.width] + 1
      const $cell = this.view.state.doc.resolve(lastCellPos)
      const sel = CellSelection.rowSelection($cell)
      if (sel) {
        this.view.dispatch(this.view.state.tr.setSelection(sel))
        addRowAfter(this.view.state, this.view.dispatch)
      }
    }
    this.view.focus()
  }
}
