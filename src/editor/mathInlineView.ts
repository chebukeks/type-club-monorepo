import { Node as PMNode } from 'prosemirror-model'
import { EditorView, NodeView } from 'prosemirror-view'
import katex from 'katex'

export class MathInlineView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement
  renderDOM: HTMLElement
  node: PMNode
  view: EditorView
  getPos: () => number | undefined

  constructor(node: PMNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos

    this.dom = document.createElement('span')
    // ВАЖНО: класс должен матчить parseDOM ('math-inline')
    this.dom.className = 'math-inline'

    const prefix = document.createElement('span')
    prefix.className = 'math-inline-prefix'
    prefix.textContent = '$'
    this.dom.appendChild(prefix)

    this.contentDOM = document.createElement('span')
    this.contentDOM.className = 'math-inline-editor'

    this.renderDOM = document.createElement('span')
    this.renderDOM.className = 'math-inline-render'
    this.renderDOM.contentEditable = 'false'

    this.dom.appendChild(this.contentDOM)
    this.dom.appendChild(this.renderDOM)

    this.renderMath()
  }

  renderMath() {
    const text = this.node.textContent?.trim() || ''
    if (!text) {
      this.renderDOM.innerHTML = '<span style="color: grey; opacity: 0.5;">Empty Math</span>'
      return
    }
    
    try {
      this.renderDOM.innerHTML = ''
      katex.render(text, this.renderDOM, {
        throwOnError: false,
        displayMode: false
      })
    } catch (e) {
      this.renderDOM.textContent = text
    }
  }

  update(node: PMNode) {
    if (node.type !== this.node.type) return false
    this.node = node
    this.renderMath()
    return true
  }

  ignoreMutation(mutation: MutationRecord | { target: Node, type: string }) {
    // Если мутация внутри редактора текста формулы, разрешаем ProseMirror обработать её (return false).
    // Если снаружи (например, Katex обновляется), игнорируем (return true).
    if (this.contentDOM.contains(mutation.target)) {
      return false
    }
    return true
  }
}

