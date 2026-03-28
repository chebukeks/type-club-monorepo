import { Node as PMNode } from 'prosemirror-model'
import { EditorView, NodeView } from 'prosemirror-view'
import { TextSelection } from 'prosemirror-state'
import katex from 'katex'

export class MathInlineView implements NodeView {
  dom: HTMLElement
  editorDOM: HTMLElement
  renderDOM: HTMLElement
  node: PMNode
  view: EditorView
  getPos: () => number | undefined

  constructor(node: PMNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos

    this.dom = document.createElement('span')
    this.dom.className = 'math-inline-wrapper'

    const prefix = document.createElement('span')
    prefix.className = 'math-inline-prefix'
    prefix.textContent = '$'
    this.dom.appendChild(prefix)

    this.editorDOM = document.createElement('span')
    this.editorDOM.className = 'math-inline-editor'
    this.editorDOM.contentEditable = 'true'
    this.editorDOM.dataset.placeholder = 'Empty Math'
    this.editorDOM.textContent = node.attrs.formula || ''

    // Блокируем всплытие событий, чтобы ProseMirror не удалил ноду при печати (так как это NodeSelection)
    this.editorDOM.addEventListener('mousedown', e => e.stopPropagation())
    this.editorDOM.addEventListener('keydown', e => this.handleKeyDown(e))
    this.editorDOM.addEventListener('input', () => {
      const val = this.editorDOM.textContent || ''
      if (val !== this.node.attrs.formula) {
        const pos = this.getPos()
        if (pos !== undefined) {
          this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, null, { formula: val }))
        }
      }
    })

    this.renderDOM = document.createElement('span')
    this.renderDOM.className = 'math-inline-render'
    this.renderDOM.contentEditable = 'false'

    this.dom.appendChild(this.editorDOM)
    this.dom.appendChild(this.renderDOM)

    this.renderMath()
  }

  handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      const pos = this.getPos()
      if (pos === undefined) return
      
      let tr = this.view.state.tr
      tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)))
      this.view.dispatch(tr)
      this.view.focus()
    } else if (e.key === '$') {
      e.preventDefault()
      e.stopPropagation()
      const pos = this.getPos()
      if (pos === undefined) return
      
      let tr = this.view.state.tr
      const text = this.editorDOM.textContent?.trim() || ''
      if (text.length === 0) {
        tr.replaceWith(pos, pos + 1, this.view.state.schema.text('$$'))
        tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 2)))
      } else {
        tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)))
      }
      this.view.dispatch(tr)
      this.view.focus()
    } else if (e.key === 'Backspace' && (this.editorDOM.textContent?.trim() || '') === '') {
      e.preventDefault()
      e.stopPropagation()
      
      const pos = this.getPos()
      if (pos === undefined) return
      
      let tr = this.view.state.tr
      tr.replaceWith(pos, pos + 1, this.view.state.schema.text('$'))
      tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)))
      this.view.dispatch(tr)
      this.view.focus()
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // Allow arrows to move naturally within the input
      e.stopPropagation()
    } else if (e.key === 'Enter') {
      // Prevent enter from creating a new line in our raw span
      e.preventDefault()
      e.stopPropagation()
    } else {
      e.stopPropagation()
    }
  }

  renderMath() {
    const text = this.node.attrs.formula?.trim() || ''
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
    
    const currentDOMText = this.editorDOM.textContent || ''
    if (currentDOMText !== node.attrs.formula) {
      this.editorDOM.textContent = node.attrs.formula || ''
    }
    
    this.renderMath()
    return true
  }

  selectNode() {
    this.dom.classList.add('is-active')
    this.editorDOM.focus()
  }

  deselectNode() {
    this.dom.classList.remove('is-active')
  }

  // Захватываем контроль над выделением! ProseMirror вызывает этот метод
  setSelection(_anchor: number, _head: number, _root: Document | ShadowRoot) {
    this.editorDOM.focus()
    const sel = window.getSelection()
    if (sel) {
      const range = document.createRange()
      range.selectNodeContents(this.editorDOM)
      range.collapse(false) // в конец текста
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }

  ignoreMutation() {
    // Полностью берем на себя ответственность за мутации внутри этого NodeView
    return true
  }
}
