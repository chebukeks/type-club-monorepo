/**
 * ImageView.ts — Кастомный NodeView для блочного изображения.
 * Показывает картинку с подписью (alt) по центру.
 * Клик по подписи открывает inline-редактирование.
 */
import { Node as PMNode } from 'prosemirror-model'
import { EditorView, NodeView } from 'prosemirror-view'

export class ImageView implements NodeView {
  dom: HTMLElement
  node: PMNode
  view: EditorView
  getPos: () => number | undefined

  private img: HTMLImageElement
  private caption: HTMLElement
  private captionInput: HTMLInputElement | null = null

  constructor(node: PMNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos

    // Контейнер <figure>
    this.dom = document.createElement('figure')
    this.dom.className = 'image-block'
    this.dom.contentEditable = 'false'

    // Картинка
    this.img = document.createElement('img')
    this.img.src = node.attrs.src || ''
    if (node.attrs.alt) this.img.alt = node.attrs.alt
    if (node.attrs.title) this.img.title = node.attrs.title
    this.dom.appendChild(this.img)

    // Подпись
    this.caption = document.createElement('figcaption')
    this.caption.className = 'image-caption'
    const hasAlt = !!node.attrs.alt
    this.caption.textContent = hasAlt ? node.attrs.alt : 'Добавить подпись...'
    if (!hasAlt) {
      this.caption.classList.add('placeholder')
      if (!this.view.editable) {
        this.caption.style.display = 'none'
      }
    }
    this.dom.appendChild(this.caption)

    // Клик по подписи → редактирование
    this.caption.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.startEditing()
    })
  }

  private startEditing() {
    if (!this.view.editable || this.captionInput) return // уже редактируем или превью

    this.caption.style.display = 'none'

    this.captionInput = document.createElement('input')
    this.captionInput.type = 'text'
    this.captionInput.className = 'image-caption-input'
    this.captionInput.value = this.node.attrs.alt || ''
    this.captionInput.placeholder = 'Подпись к изображению...'

    this.dom.appendChild(this.captionInput)
    this.captionInput.focus()
    this.captionInput.select()

    const finish = () => {
      if (!this.captionInput) return
      const newAlt = this.captionInput.value.trim()
      const pos = this.getPos()

      // Удаляем инпут и показываем подпись
      this.captionInput.remove()
      this.captionInput = null
      this.caption.style.display = ''

      if (pos === undefined) return

      // Обновляем атрибут alt
      const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
        ...this.node.attrs,
        alt: newAlt || null,
      })
      this.view.dispatch(tr)
    }

    this.captionInput.addEventListener('blur', finish)
    this.captionInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault()
        this.captionInput?.blur()
      }
    })
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node

    // Обновляем img
    if (this.img.src !== node.attrs.src) this.img.src = node.attrs.src || ''
    if (node.attrs.alt) {
      this.img.alt = node.attrs.alt
    }

    // Обновляем подпись (если не в режиме редактирования)
    if (!this.captionInput) {
      const hasAlt = !!node.attrs.alt
      this.caption.textContent = hasAlt ? node.attrs.alt : 'Добавить подпись...'
      if (!hasAlt) {
        this.caption.classList.add('placeholder')
        this.caption.style.display = this.view.editable ? '' : 'none'
      } else {
        this.caption.classList.remove('placeholder')
        this.caption.style.display = ''
      }
    }

    return true
  }

  stopEvent(e: Event) {
    const target = e.target as HTMLElement
    if (this.caption.contains(target) || (this.captionInput && this.captionInput.contains(target))) {
      return true
    }
    return false
  }
  ignoreMutation() { return true }
}
