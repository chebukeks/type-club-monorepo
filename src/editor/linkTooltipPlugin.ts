import { Plugin, PluginKey } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'

const tooltipKey = new PluginKey('linkTooltip')

class TooltipView {
  tooltip: HTMLElement
  input: HTMLInputElement
  view: EditorView
  activeUrl: string = ''
  activeRange: { from: number; to: number } | null = null
  isImage: boolean = false

  constructor(view: EditorView) {
    this.view = view
    this.tooltip = document.createElement('div')
    this.tooltip.className = 'pm-tooltip'
    
    this.input = document.createElement('input')
    this.input.type = 'text'
    this.input.placeholder = 'https://...'
    this.input.className = 'pm-tooltip-input'
    
    // При нажатии Enter сохраняем URL
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        this.saveUrl()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        this.hide()
        this.view.focus()
      }
    })

    this.tooltip.appendChild(this.input)
    document.body.appendChild(this.tooltip)
    this.hide()
  }

  saveUrl() {
    if (!this.activeRange) return
    const newUrl = this.input.value
    const tr = this.view.state.tr

    if (this.isImage) {
      // Обновляем атрибут src у картинки
      tr.setNodeMarkup(this.activeRange.from, null, {
        ...this.view.state.doc.nodeAt(this.activeRange.from)!.attrs,
        src: newUrl
      })
    } else {
      // Обновляем mark у ссылки
      const { schema } = this.view.state
      tr.removeMark(this.activeRange.from, this.activeRange.to, schema.marks.link)
      if (newUrl) {
        tr.addMark(this.activeRange.from, this.activeRange.to, schema.marks.link.create({ href: newUrl }))
      }
    }

    this.view.dispatch(tr)
    this.hide()
    this.view.focus()
  }

  update(view: EditorView, _lastState: any) {
    const state = view.state
    const { selection } = state

    // Прячем тултип, если выделение изменилось и мы не находимся в тултипе
    if (document.activeElement === this.input) return

    if (!selection.empty && !this.isImageNodeSelection(view)) {
      this.hide()
      return
    }

    // Ищем марку link
    const $pos = selection.$from
    const linkMark = $pos.marks().find(m => m.type.name === 'link')
    
    // Ищем ноду image (например, если она выделена как NodeSelection)
    const nodeAfter = $pos.nodeAfter
    const isImage = nodeAfter && nodeAfter.type.name === 'image' && selection.from === $pos.pos && selection.to === $pos.pos + nodeAfter.nodeSize

    if (!linkMark && !isImage) {
      this.hide()
      return
    }

    this.isImage = !!isImage
    this.activeUrl = isImage ? nodeAfter!.attrs.src : linkMark!.attrs.href

    // Находим полный диапазон марки (или ноды)
    if (isImage) {
      this.activeRange = { from: $pos.pos, to: $pos.pos + nodeAfter!.nodeSize }
    } else {
      const parent = $pos.parent
      const parentStart = $pos.start()
      
      let startOffset = $pos.parentOffset
      let endOffset = $pos.parentOffset

      while (startOffset > 0 && parent.childBefore(startOffset).node?.marks.includes(linkMark!)) {
        startOffset -= parent.childBefore(startOffset).node!.nodeSize
      }
      while (endOffset < parent.nodeSize - 2 && parent.childAfter(endOffset).node?.marks.includes(linkMark!)) {
        endOffset += parent.childAfter(endOffset).node!.nodeSize
      }

      // Упрощенный поиск диапазона ссылки, если курсор внутри (можно использовать из seamlessPlugin, но тут он локальный)
      let from = parentStart, to = parentStart
      parent.forEach((child, offset) => {
        if (child.marks.includes(linkMark!)) {
          if (from === parentStart) from = parentStart + offset
          to = parentStart + offset + child.nodeSize
        }
      })
      this.activeRange = { from, to }
    }

    this.input.value = this.activeUrl
    this.show()
    
    // Позиционируем
    const coords = view.coordsAtPos(this.activeRange.from)
    this.tooltip.style.left = coords.left + 'px'
    this.tooltip.style.top = coords.bottom + 5 + 'px' // чуть ниже текста
  }

  isImageNodeSelection(view: EditorView) {
    const { selection } = view.state
    if (selection.from !== selection.to) {
      const node = view.state.doc.nodeAt(selection.from)
      if (node && node.type.name === 'image' && selection.to === selection.from + node.nodeSize) {
        return true
      }
    }
    return false
  }

  show() {
    this.tooltip.style.display = 'block'
  }

  hide() {
    this.tooltip.style.display = 'none'
    this.activeRange = null
  }

  destroy() {
    this.tooltip.remove()
  }
}

export function linkTooltipPlugin() {
  return new Plugin({
    key: tooltipKey,
    view(editorView) {
      return new TooltipView(editorView)
    }
  })
}
