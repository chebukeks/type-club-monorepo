import { Node as PMNode } from 'prosemirror-model'
import { EditorView, NodeView } from 'prosemirror-view'
import { suggestionPluginKey } from './suggestionPlugin'

/**
 * Кастомный View для блока кода (code_block).
 * Оборачивает содержимое в UI-компонент в стиле Telegram:
 * шапка с языком и кнопкой копирования, а также контейнер для кода.
 */
export class CodeBlockView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement
  node: PMNode
  view: EditorView
  getPos: () => number | undefined

  constructor(node: PMNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos

    // Внешняя обертка блока
    this.dom = document.createElement('div')
    this.dom.className = 'code-block-wrapper'

    // Шапка (Header)
    const header = document.createElement('div')
    header.className = 'code-block-header'

    const lang = document.createElement('span')
    lang.className = 'code-block-lang'
    lang.textContent = node.attrs.params || 'text'

    const copyBtn = document.createElement('button')
    copyBtn.className = 'code-block-copy'
    copyBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="copy-icon">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
    `
    // Логика копирования
    copyBtn.addEventListener('click', (e) => {
      e.preventDefault()
      navigator.clipboard.writeText(this.node.textContent).then(() => {
        const originalHtml = copyBtn.innerHTML
        copyBtn.innerHTML = '<span class="copied-text">Copied!</span>'
        setTimeout(() => copyBtn.innerHTML = originalHtml, 2000)
      })
    })

    // Блокируем события мыши на пустом пространстве шапки, чтобы не сдвигать курсор PM
    header.contentEditable = 'false'
    
    header.appendChild(lang)
    header.appendChild(copyBtn)

    // Контейнер для текста
    const pre = document.createElement('pre')
    this.contentDOM = document.createElement('code')
    this.contentDOM.className = 'code-block-content'
    if (suggestionPluginKey.getState(this.view.state)?.active) {
      this.contentDOM.contentEditable = 'false'
    }

    pre.appendChild(this.contentDOM)

    this.dom.appendChild(header)
    this.dom.appendChild(pre)
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    
    // Обновляем текст языка, если он изменился
    const langSpan = this.dom.querySelector('.code-block-lang')
    if (langSpan) {
      langSpan.textContent = node.attrs.params || 'text'
    }

    if (suggestionPluginKey.getState(this.view.state)?.active) {
      this.contentDOM.contentEditable = 'false'
    } else {
      this.contentDOM.removeAttribute('contenteditable')
    }
    
    return true
  }

  ignoreMutation(mutation: any): boolean {
    // Игнорируем изменения, которые происходят в шапке (header),
    // чтобы ProseMirror не пытался их "исправить"
    if (!this.contentDOM.contains(mutation.target)) {
      return true
    }
    return false
  }
}
