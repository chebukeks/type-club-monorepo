/**
 * ImageView.ts — Кастомный NodeView для блочного изображения.
 * Показывает картинку с подписью (alt) по центру.
 * Клик по подписи открывает inline-редактирование.
 * Автоматически распознаёт ссылки на YouTube и рендерит плеер.
 */
import { Node as PMNode } from 'prosemirror-model'
import { EditorView, NodeView } from 'prosemirror-view'

function parseYouTubeUrl(url: string): { videoId: string, start?: string } | null {
  if (!url) return null;
  const regExp = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regExp);
  if (!match) return null;
  
  const videoId = match[1];
  let start = '';
  const tMatch = url.match(/[?&]t=([0-9hms]+)/);
  if (tMatch) {
    start = tMatch[1];
    if (start.includes('h') || start.includes('m') || start.includes('s')) {
      let seconds = 0;
      const h = start.match(/(\d+)h/);
      const m = start.match(/(\d+)m/);
      const s = start.match(/(\d+)s/);
      if (h) seconds += parseInt(h[1]) * 3600;
      if (m) seconds += parseInt(m[1]) * 60;
      if (s) seconds += parseInt(s[1]);
      start = seconds.toString();
    }
  }

  return { videoId, start };
}

export class ImageView implements NodeView {
  dom: HTMLElement
  node: PMNode
  view: EditorView
  getPos: () => number | undefined

  private mediaContainer: HTMLElement
  private caption: HTMLElement
  private captionInput: HTMLInputElement | null = null
  private currentSrc: string = ''

  constructor(node: PMNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos

    // Контейнер <figure>
    this.dom = document.createElement('figure')
    this.dom.className = 'image-block'
    this.dom.contentEditable = 'false'

    this.mediaContainer = document.createElement('div')
    this.mediaContainer.className = 'media-container'
    this.mediaContainer.style.position = 'relative'
    this.dom.appendChild(this.mediaContainer)

    // Подпись
    this.caption = document.createElement('figcaption')
    this.caption.className = 'image-caption'
    this.dom.appendChild(this.caption)

    // Клик по подписи → редактирование
    this.caption.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.startEditing()
    })

    this.renderMedia()
    this.updateCaption()
  }

  private renderMedia() {
    this.mediaContainer.innerHTML = ''
    this.currentSrc = this.node.attrs.src || ''

    const yt = parseYouTubeUrl(this.currentSrc)
    if (yt) {
      const iframe = document.createElement('iframe')
      let src = `https://www.youtube.com/embed/${yt.videoId}`
      if (yt.start) src += `?start=${yt.start}`
      iframe.src = src
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
      iframe.allowFullscreen = true
      iframe.style.width = '100%'
      iframe.style.aspectRatio = '16 / 9'
      iframe.style.border = 'none'
      iframe.style.borderRadius = '6px'
      iframe.style.display = 'block'
      
      this.mediaContainer.appendChild(iframe)

      if (this.view.editable) {
        // Overlay block in Seamless mode to capture clicks for ProseMirror
        const overlay = document.createElement('div')
        overlay.style.position = 'absolute'
        overlay.style.top = '0'
        overlay.style.left = '0'
        overlay.style.right = '0'
        overlay.style.bottom = '0'
        overlay.style.zIndex = '10'
        overlay.style.cursor = 'pointer'
        this.mediaContainer.appendChild(overlay)
      }
    } else {
      const img = document.createElement('img')
      img.src = this.currentSrc
      if (this.node.attrs.alt) img.alt = this.node.attrs.alt
      if (this.node.attrs.title) img.title = this.node.attrs.title
      this.mediaContainer.appendChild(img)
    }
  }

  private updateCaption() {
    if (this.captionInput) return
    const hasAlt = !!this.node.attrs.alt
    this.caption.textContent = hasAlt ? this.node.attrs.alt : 'Добавить подпись...'
    if (!hasAlt) {
      this.caption.classList.add('placeholder')
      this.caption.style.display = this.view.editable ? '' : 'none'
    } else {
      this.caption.classList.remove('placeholder')
      this.caption.style.display = ''
    }
  }

  private startEditing() {
    if (!this.view.editable || this.captionInput) return

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

      this.captionInput.remove()
      this.captionInput = null
      this.caption.style.display = ''

      if (pos === undefined) return

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

    if (this.currentSrc !== (node.attrs.src || '')) {
      this.renderMedia()
    } else if (!parseYouTubeUrl(this.currentSrc)) {
      const img = this.mediaContainer.querySelector('img')
      if (img) {
        img.alt = node.attrs.alt || ''
        img.title = node.attrs.title || ''
      }
    }

    this.updateCaption()
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
