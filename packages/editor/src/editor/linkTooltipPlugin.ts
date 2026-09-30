import { Plugin, PluginKey } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'

const tooltipKey = new PluginKey('linkTooltip')

class TooltipView {
  tooltip: HTMLElement
  input: HTMLInputElement
  view: EditorView
  activeUrl: string = ''
  activeRange: { from: number; to: number } | null = null

  private onImageMenu: () => void

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
    const parent = this.view.dom.parentNode as HTMLElement
    if (parent) {
      parent.style.position = 'relative'
      parent.appendChild(this.tooltip)
    } else {
      document.body.appendChild(this.tooltip)
    }

    this.onImageMenu = () => {
      this.hide()
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('editor-image-context-menu', this.onImageMenu)
    }

    this.hide()
  }

  saveUrl() {
    if (!this.activeRange) return
    const newUrl = this.input.value

    if (newUrl === this.activeUrl) {
      this.hide()
      this.view.focus()
      return
    }

    const tr = this.view.state.tr
    const { schema } = this.view.state
    tr.removeMark(this.activeRange.from, this.activeRange.to, schema.marks.link)
    if (newUrl) {
      tr.addMark(this.activeRange.from, this.activeRange.to, schema.marks.link.create({ href: newUrl }))
    }

    this.view.dispatch(tr)
    this.hide()
    this.view.focus()
  }

  update(view: EditorView, _lastState: any) {
    const state = view.state
    const { selection } = state

    // Прячем тултип, если фокус в инпуте тултипа
    if (document.activeElement === this.input) return

    if (!selection.empty) {
      this.hide()
      return
    }

    // Ищем марку link у курсора
    const $pos = selection.$from
    const linkMark = $pos.marks().find(m => m.type.name === 'link')

    if (!linkMark) {
      this.hide()
      return
    }

    this.activeUrl = linkMark.attrs.href || ''

    // Находим полный диапазон марки link
    const parent = $pos.parent
    const parentStart = $pos.start()

    let from = parentStart
    let to = parentStart
    parent.forEach((child, offset) => {
      if (child.marks.includes(linkMark)) {
        if (from === parentStart) from = parentStart + offset
        to = parentStart + offset + child.nodeSize
      }
    })
    this.activeRange = { from, to }

    this.input.value = this.activeUrl
    this.show()

    // Позиционируем
    const coords = view.coordsAtPos(this.activeRange.from)
    const parentEl = this.view.dom.parentNode as HTMLElement
    const parentRect = parentEl ? parentEl.getBoundingClientRect() : { left: 0, top: 0 }

    this.tooltip.style.left = (coords.left - parentRect.left) + 'px'
    this.tooltip.style.top = (coords.bottom - parentRect.top) + 5 + 'px'
  }

  show() {
    this.tooltip.style.display = 'block'
  }

  hide() {
    this.tooltip.style.display = 'none'
    this.activeRange = null
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('editor-image-context-menu', this.onImageMenu)
    }
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
