import { Node } from 'prosemirror-model'
import { EditorView, NodeView } from 'prosemirror-view'

const chevronSvg = `<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
  <path d="M4 2l4 4-4 4z"></path>
</svg>`

export class HeadingView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement
  node: Node
  view: EditorView
  getPos: () => number | undefined

  constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos

    const level = node.attrs.level
    this.dom = document.createElement(`h${level}`)
    this.dom.classList.add('editor-heading')
    
    const foldBtn = document.createElement('button')
    foldBtn.className = 'heading-fold-btn'
    foldBtn.contentEditable = 'false'
    foldBtn.innerHTML = chevronSvg
    foldBtn.onmousedown = (e) => {
      e.preventDefault()
      e.stopPropagation() // Prevent selection
      const pos = this.getPos()
      if (typeof pos === 'number') {
        view.dispatch(view.state.tr.setMeta('toggleFold', pos))
      }
    }

    const contentSpan = document.createElement('span')
    contentSpan.className = 'heading-content'
    this.contentDOM = contentSpan

    this.dom.appendChild(foldBtn)
    this.dom.appendChild(this.contentDOM)
  }

  update(node: Node) {
    if (node.type.name !== 'heading' || node.attrs.level !== this.node.attrs.level) return false
    this.node = node
    return true
  }
  
  ignoreMutation(mutation: any) {
    // Ignore mutations on the button itself
    if (mutation.type !== 'selection' && mutation.target && mutation.target.nodeType === 1 && (mutation.target as Element).closest('.heading-fold-btn')) {
      return true
    }
    return false
  }
}
