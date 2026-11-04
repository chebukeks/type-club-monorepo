import { Plugin } from 'prosemirror-state'
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view'
import { ResolvedPos, Node as PMNode } from 'prosemirror-model'
import {
  ResizeState,
  TableMap,
  TableView,
  cellAround,
  columnResizingPluginKey,
  tableNodeTypes,
  updateColumnsOnResize,
} from 'prosemirror-tables'

export interface ColumnResizingOptions {
  handleWidth?: number
  cellMinWidth?: number
  defaultCellMinWidth?: number
  lastColumnResizable?: boolean
}

function zeroes(n: number): number[] {
  return Array(n).fill(0)
}

function domCellAround(target: any): HTMLElement | null {
  while (target && target.nodeName !== 'TD' && target.nodeName !== 'TH') {
    target = target.classList && target.classList.contains('ProseMirror') ? null : target.parentNode
  }
  return target
}

function pointsAtCell($pos: ResolvedPos): boolean {
  return $pos.parent.type.spec.tableRole === 'row' && !!$pos.nodeAfter
}

function edgeCell(
  view: EditorView,
  event: MouseEvent,
  side: 'left' | 'right',
  handleWidth: number
): number {
  const offset = side === 'right' ? -handleWidth : handleWidth
  const found = view.posAtCoords({
    left: event.clientX + offset,
    top: event.clientY,
  })
  if (!found) return -1
  const { pos } = found
  const $cell = cellAround(view.state.doc.resolve(pos))
  if (!$cell) return -1
  if (side === 'right') return $cell.pos
  const map = TableMap.get($cell.node(-1))
  const start = $cell.start(-1)
  const index = map.map.indexOf($cell.pos - start)
  return index % map.width === 0 ? -1 : start + map.map[index - 1]
}

function currentColWidth(view: EditorView, cellPos: number, attrs: { colspan: number; colwidth: number[] | null }): number {
  const { colspan, colwidth } = attrs
  const width = colwidth && colwidth[colwidth.length - 1]
  if (width) return width
  const dom = view.domAtPos(cellPos)
  const child = dom.node.childNodes[dom.offset] as HTMLElement | undefined
  let domWidth = child?.offsetWidth || 0
  let parts = colspan
  if (colwidth) {
    for (let i = 0; i < colspan; i++) {
      if (colwidth[i]) {
        domWidth -= colwidth[i]
        parts--
      }
    }
  }
  return Math.max(25, domWidth / (parts || 1))
}

function draggedWidth(
  dragging: { startX: number; startWidth: number },
  event: MouseEvent,
  cellMinWidth: number
): number {
  const offset = event.clientX - dragging.startX
  return Math.max(cellMinWidth, dragging.startWidth + offset)
}

function updateHandle(view: EditorView, value: number) {
  view.dispatch(view.state.tr.setMeta(columnResizingPluginKey, { setHandle: value }))
}

function updateColumnWidth(view: EditorView, cell: number, width: number) {
  const $cell = view.state.doc.resolve(cell)
  const table = $cell.node(-1)
  const map = TableMap.get(table)
  const start = $cell.start(-1)
  const col = map.colCount($cell.pos - start) + $cell.nodeAfter!.attrs.colspan - 1
  const tr = view.state.tr
  for (let row = 0; row < map.height; row++) {
    const mapIndex = row * map.width + col
    if (row && map.map[mapIndex] === map.map[mapIndex - map.width]) continue
    const pos = map.map[mapIndex]
    const attrs = table.nodeAt(pos)!.attrs
    const index = attrs.colspan === 1 ? 0 : col - map.colCount(pos)
    if (attrs.colwidth && attrs.colwidth[index] === width) continue
    const colwidth = attrs.colwidth ? attrs.colwidth.slice() : zeroes(attrs.colspan)
    colwidth[index] = width
    tr.setNodeMarkup(start + pos, null, {
      ...attrs,
      colwidth,
    })
  }
  if (tr.docChanged) view.dispatch(tr)
}

function displayColumnWidth(
  view: EditorView,
  cell: number,
  width: number,
  defaultCellMinWidth: number
) {
  const $cell = view.state.doc.resolve(cell)
  const table = $cell.node(-1)
  const start = $cell.start(-1)
  const col = TableMap.get(table).colCount($cell.pos - start) + $cell.nodeAfter!.attrs.colspan - 1
  let dom: any = view.domAtPos($cell.start(-1)).node
  while (dom && dom.nodeName !== 'TABLE') dom = dom.parentNode
  if (!dom) return
  updateColumnsOnResize(table, dom.firstChild, dom, defaultCellMinWidth, col, width)
}

function handleDecorations(state: any, cell: number): DecorationSet {
  const decorations: Decoration[] = []
  const $cell = state.doc.resolve(cell)
  const table = $cell.node(-1)
  if (!table) return DecorationSet.empty
  const map = TableMap.get(table)
  const start = $cell.start(-1)
  const col = map.colCount($cell.pos - start) + $cell.nodeAfter.attrs.colspan - 1
  for (let row = 0; row < map.height; row++) {
    const index = col + row * map.width
    if (
      (col === map.width - 1 || map.map[index] !== map.map[index + 1]) &&
      (row === 0 || map.map[index] !== map.map[index - map.width])
    ) {
      const cellPos = map.map[index]
      const pos = start + cellPos + table.nodeAt(cellPos).nodeSize - 1
      const dom = document.createElement('div')
      dom.className = 'column-resize-handle'
      const pluginState = columnResizingPluginKey.getState(state)
      if (pluginState?.dragging) {
        decorations.push(
          Decoration.node(start + cellPos, start + cellPos + table.nodeAt(cellPos).nodeSize, {
            class: 'column-resize-dragging',
          })
        )
      }
      decorations.push(Decoration.widget(pos, dom))
    }
  }
  return DecorationSet.create(state.doc, decorations)
}

/**
 * Custom table column resizing plugin that remains interactive even in preview / read-only mode.
 */
export function customColumnResizing({
  handleWidth = 5,
  cellMinWidth = 25,
  defaultCellMinWidth = 100,
  lastColumnResizable = true,
}: ColumnResizingOptions = {}): Plugin {
  const plugin: Plugin = new Plugin({
    key: columnResizingPluginKey,
    state: {
      init(_, state) {
        const nodeViews = (plugin.spec as any)?.props?.nodeViews
        const tableName = tableNodeTypes(state.schema).table.name
        if (nodeViews) {
          nodeViews[tableName] = (node: PMNode) => {
            return new TableView(node, defaultCellMinWidth)
          }
        }
        return new ResizeState(-1, false)
      },
      apply(tr, prev) {
        const action = tr.getMeta(columnResizingPluginKey)
        if (action && action.setHandle !== undefined) {
          return new ResizeState(action.setHandle, false)
        }
        if (action && action.setDragging !== undefined) {
          return new ResizeState(prev.activeHandle, action.setDragging)
        }
        if (prev.activeHandle > -1 && tr.docChanged) {
          let handle = tr.mapping.map(prev.activeHandle, -1)
          if (!pointsAtCell(tr.doc.resolve(handle))) handle = -1
          return new ResizeState(handle, prev.dragging)
        }
        return prev
      },
    },
    props: {
      attributes: (state): Record<string, string> => {
        const pluginState = columnResizingPluginKey.getState(state)
        return pluginState && pluginState.activeHandle > -1 ? { class: 'resize-cursor' } : {}
      },
      handleDOMEvents: {
        mousemove: (view, event) => {
          const pluginState = columnResizingPluginKey.getState(view.state)
          if (!pluginState) return false
          if (!pluginState.dragging) {
            const target = domCellAround(event.target)
            let cell = -1
            if (target) {
              const { left, right } = target.getBoundingClientRect()
              if (event.clientX - left <= handleWidth) {
                cell = edgeCell(view, event, 'left', handleWidth)
              } else if (right - event.clientX <= handleWidth) {
                cell = edgeCell(view, event, 'right', handleWidth)
              }
            }
            if (cell !== pluginState.activeHandle) {
              if (!lastColumnResizable && cell !== -1) {
                const $cell = view.state.doc.resolve(cell)
                const table = $cell.node(-1)
                const map = TableMap.get(table)
                const tableStart = $cell.start(-1)
                if (
                  map.colCount($cell.pos - tableStart) + $cell.nodeAfter!.attrs.colspan - 1 ===
                  map.width - 1
                ) {
                  return false
                }
              }
              updateHandle(view, cell)
            }
          }
          return false
        },
        mouseleave: (view) => {
          const pluginState = columnResizingPluginKey.getState(view.state)
          if (pluginState && pluginState.activeHandle > -1 && !pluginState.dragging) {
            updateHandle(view, -1)
          }
          return false
        },
        mousedown: (view, event) => {
          const win = view.dom.ownerDocument.defaultView || window
          const pluginState = columnResizingPluginKey.getState(view.state)
          if (!pluginState || pluginState.activeHandle === -1 || pluginState.dragging) {
            return false
          }
          const cell = view.state.doc.nodeAt(pluginState.activeHandle)
          if (!cell) return false
          const width = currentColWidth(view, pluginState.activeHandle, cell.attrs as any)
          view.dispatch(
            view.state.tr.setMeta(columnResizingPluginKey, {
              setDragging: {
                startX: event.clientX,
                startWidth: width,
              },
            })
          )

          function finish(finishEvent: MouseEvent) {
            win.removeEventListener('mouseup', finish)
            win.removeEventListener('mousemove', move)
            const curState = columnResizingPluginKey.getState(view.state)
            if (curState?.dragging) {
              updateColumnWidth(
                view,
                curState.activeHandle,
                draggedWidth(curState.dragging, finishEvent, cellMinWidth)
              )
              view.dispatch(view.state.tr.setMeta(columnResizingPluginKey, { setDragging: null }))
            }
          }

          function move(moveEvent: MouseEvent) {
            if (!moveEvent.which) return finish(moveEvent)
            const curState = columnResizingPluginKey.getState(view.state)
            if (!curState?.dragging) return
            const dragged = draggedWidth(curState.dragging, moveEvent, cellMinWidth)
            displayColumnWidth(view, curState.activeHandle, dragged, defaultCellMinWidth)
          }

          displayColumnWidth(view, pluginState.activeHandle, width, defaultCellMinWidth)
          win.addEventListener('mouseup', finish)
          win.addEventListener('mousemove', move)
          event.preventDefault()
          return true
        },
      },
      decorations: (state) => {
        const pluginState = columnResizingPluginKey.getState(state)
        if (pluginState && pluginState.activeHandle > -1) {
          return handleDecorations(state, pluginState.activeHandle)
        }
        return DecorationSet.empty
      },
      nodeViews: {},
    },
  })
  return plugin
}
