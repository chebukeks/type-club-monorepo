/**
 * ImageView.ts — Кастомный NodeView для блочного изображения.
 * Показывает картинку с подписью (alt) по центру.
 * Клик по подписи открывает inline-редактирование.
 * Автоматически распознаёт ссылки на YouTube и рендерит плеер.
 *
 * Оптимизация: data: URI конвертируются в blob URL для отображения.
 * Это убирает мегабайтные строки из DOM и даёт GPU нативные изображения,
 * решая проблему "Failed to serialize op in 16777152 bytes".
 */
import { Node as PMNode } from 'prosemirror-model'
import { EditorView, NodeView } from 'prosemirror-view'

import { ImageLightbox } from './ImageLightbox'
import { parseVideoEmbed, isVideoUrl, parseYouTubeUrl } from './videoUtils'
export { parseYouTubeUrl, parseVideoEmbed, isVideoUrl }

// Кеш blob URL: data URI → blob URL.
// Ключ = длина строки + первые 64 символа (достаточно для уникальности, избегаем хеширования МБ).
const blobUrlCache = new Map<string, string>()

function dataUriToBlobUrl(dataUri: string): string {
  const cacheKey = dataUri.length + ':' + dataUri.substring(0, 64)
  const cached = blobUrlCache.get(cacheKey)
  if (cached) return cached

  const commaIdx = dataUri.indexOf(',')
  if (commaIdx === -1) return dataUri

  const header = dataUri.substring(0, commaIdx)
  const base64 = dataUri.substring(commaIdx + 1)
  const mimeMatch = header.match(/data:([^;]+)/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/png'

  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  const blob = new Blob([bytes], { type: mime })
  const url = URL.createObjectURL(blob)
  blobUrlCache.set(cacheKey, url)
  return url
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

    const video = parseVideoEmbed(this.currentSrc)
    if (video) {
      const iframe = document.createElement('iframe')
      iframe.src = video.embedUrl
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen'
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
      // Конвертируем data: URI в blob URL для отображения.
      // Это убирает мегабайтные base64 строки из DOM-атрибутов
      // и решает проблему GPU растеризатора Chromium (16 МБ лимит).
      if (this.currentSrc.startsWith('data:')) {
        img.src = dataUriToBlobUrl(this.currentSrc)
      } else if (this.currentSrc.startsWith('/uploads/') && typeof window !== 'undefined' && (window as any).__TYPE_CLUB_SITE_URL__) {
        img.src = `${(window as any).__TYPE_CLUB_SITE_URL__}${this.currentSrc}`
      } else {
        img.src = this.currentSrc
      }
      if (this.node.attrs.alt) img.alt = this.node.attrs.alt
      if (this.node.attrs.title) img.title = this.node.attrs.title
      
      const isPreview = this.view.dom.closest('.preview-mode') !== null || !this.view.editable
      if (isPreview) {
        img.style.cursor = 'zoom-in'
        img.onclick = (e) => {
          e.preventDefault()
          e.stopPropagation()
          ImageLightbox.open({ src: img.src, alt: img.alt })
        }
      } else {
        const handleContextMenu = (e: MouseEvent) => {
          e.preventDefault()
          e.stopPropagation()
          const pos = this.getPos()
          if (pos === undefined) return
          const detail = {
            pos,
            src: this.currentSrc,
            alt: this.node.attrs.alt,
            title: this.node.attrs.title,
            clientX: e.clientX,
            clientY: e.clientY,
          }
          const event = new CustomEvent('editor-image-context-menu', {
            bubbles: true,
            composed: true,
            detail,
          })
          this.view.dom.dispatchEvent(event)
          window.dispatchEvent(new CustomEvent('editor-image-context-menu', { detail }))
        }
        img.addEventListener('contextmenu', handleContextMenu)
        this.mediaContainer.addEventListener('contextmenu', handleContextMenu)
      }
      
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
    } else if (!isVideoUrl(this.currentSrc)) {
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
    if (e.type === 'contextmenu') {
      return true
    }
    const target = e.target as HTMLElement
    if (this.caption.contains(target) || (this.captionInput && this.captionInput.contains(target))) {
      return true
    }
    return false
  }

  ignoreMutation() { return true }
}
