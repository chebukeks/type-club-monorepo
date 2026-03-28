import { Node as PMNode } from 'prosemirror-model'
import { EditorView, NodeView } from 'prosemirror-view'
import { TextSelection } from 'prosemirror-state'
import katex from 'katex'

export class MathBlockView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement
  renderDOM: HTMLElement
  previewWrapper: HTMLElement
  node: PMNode
  view: EditorView
  getPos: () => number | undefined

  constructor(node: PMNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos

    this.dom = document.createElement('div')
    this.dom.className = 'math-block-wrapper'

    // Editor Area
    const editorWrapper = document.createElement('div')
    editorWrapper.className = 'math-block-editor-wrapper'
    
    this.contentDOM = document.createElement('div')
    this.contentDOM.className = 'math-block-editor'
    editorWrapper.appendChild(this.contentDOM)

    // Preview Area
    this.previewWrapper = document.createElement('div')
    this.previewWrapper.className = 'math-block-preview-wrapper'
    this.previewWrapper.contentEditable = 'false'

    const previewHeader = document.createElement('div')
    previewHeader.className = 'math-block-preview-header'
    previewHeader.innerHTML = `
      <span class="math-block-title">Preview <i>(math)</i></span>
      <div class="math-block-actions">
        <button class="math-btn-ok">✔ OK</button>
      </div>
    `
    // Кнопка OK убирает фокус
    const okBtn = previewHeader.querySelector('.math-btn-ok')
    okBtn?.addEventListener('click', () => {
      this.dom.classList.remove('is-active')
      // Просто ставим выделение после блока
      const pos = this.getPos()
      if (pos !== undefined) {
        const { tr } = this.view.state
        tr.setSelection(TextSelection.near(tr.doc.resolve(pos + this.node.nodeSize)))
        this.view.dispatch(tr)
      }
    })

    this.renderDOM = document.createElement('div')
    this.renderDOM.className = 'math-block-render'

    this.previewWrapper.appendChild(previewHeader)
    this.previewWrapper.appendChild(this.renderDOM)

    this.dom.appendChild(editorWrapper)
    this.dom.appendChild(this.previewWrapper)

    this.renderMath()
  }

  renderMath() {
    try {
      katex.render(this.node.textContent || '', this.renderDOM, {
        throwOnError: false,
        displayMode: true
      })
    } catch (e) {
      this.renderDOM.textContent = this.node.textContent
    }
  }

  update(node: PMNode) {
    if (node.type !== this.node.type) return false
    this.node = node
    this.renderMath()
    return true
  }

  ignoreMutation(mutation: any): boolean {
    if (!this.contentDOM.contains(mutation.target)) {
      return true
    }
    return false
  }
}
