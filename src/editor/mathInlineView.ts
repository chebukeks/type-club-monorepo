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
  isCursorInside: boolean = false

  constructor(node: PMNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos

    this.dom = document.createElement('span')
    this.dom.className = 'math-inline-wrapper'

    // Сырой текст (редактируемый)
    this.contentDOM = document.createElement('span')
    this.contentDOM.className = 'math-inline-editor'

    // Отрендеренный KaTeX
    this.renderDOM = document.createElement('span')
    this.renderDOM.className = 'math-inline-render'
    this.renderDOM.contentEditable = 'false'

    // Декоративные значки $ вокруг текста, чтобы было удобнее
    const prefix = document.createElement('span')
    prefix.className = 'math-inline-prefix'
    prefix.textContent = '$'
    prefix.contentEditable = 'false'
    
    // В editor засовываем только контент, так как $ мы рендерим визуально как ::before/::after
    this.dom.appendChild(this.contentDOM)
    this.dom.appendChild(this.renderDOM)

    this.renderMath()
  }

  renderMath() {
    try {
      katex.render(this.node.textContent || '', this.renderDOM, {
        throwOnError: false,
        displayMode: false
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
    // игнорируем мутации снаружи contentDOM
    if (!this.contentDOM.contains(mutation.target)) {
      return true
    }
    return false
  }
}
