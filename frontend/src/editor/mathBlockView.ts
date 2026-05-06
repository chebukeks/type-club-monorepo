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
      // НЕ делаем this.dom.classList.remove('is-active') вручную, 
      // потому что этим классом управляют Декорации ProseMirror!
      // Если мы удалим класс руками, а курсор останется внутри (как в файле из 1 формулы), 
      // то ProseMirror подумает, что декорация на месте, и не станет показывать редактор при повторном клике.
      
      const pos = this.getPos()
      console.log('[mathBlockView] OK click. Node pos:', pos)
      
      if (pos !== undefined) {
        let { tr } = this.view.state
        const endPos = pos + this.node.nodeSize
        
        // Если формула — последний элемент в документе, после нее нет места для курсора.
        // Добавим пустой абзац.
        if (endPos === tr.doc.content.size) {
           console.log('[mathBlockView] Block is at the end of doc. Appending paragraph to escape.')
           const p = this.view.state.schema.nodes.paragraph.create()
           tr = tr.insert(endPos, p)
        }
        
        tr = tr.setSelection(TextSelection.near(tr.doc.resolve(endPos)))
        console.log('[mathBlockView] Setting selection to escape block.')
        this.view.dispatch(tr)
      }
    })

    this.renderDOM = document.createElement('div')
    this.renderDOM.className = 'math-block-render'

    this.previewWrapper.appendChild(previewHeader)
    this.previewWrapper.appendChild(this.renderDOM)

    this.dom.appendChild(editorWrapper)
    this.dom.appendChild(this.previewWrapper)
    
    // При клике на превью, если мы не по кнопке OK, переводим формулу в режим редактирования
    // ставя курсор внутрь блока, что вызовет появление класса is-active от mathActivePlugin.
    this.previewWrapper.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('.math-btn-ok')) return
      
      const pos = this.getPos()
      console.log('[mathBlockView] Mousedown on preview. Node pos:', pos)
      
      if (pos !== undefined) {
        const { tr } = this.view.state
        const targetPos = pos + 1
        console.log('[mathBlockView] Putting selection inside block at pos:', targetPos)
        
        // Если выделение УЖЕ там, форсируем обновление, чтобы вернуть класс (если он пропал)
        if (tr.selection.from === targetPos) {
           console.log('[mathBlockView] Selection already at target Pos. Forcing meta update.')
           tr.setMeta('forceUpdate', true)
        } else {
           tr.setSelection(TextSelection.create(tr.doc, targetPos))
        }
        this.view.dispatch(tr)
        e.preventDefault()
      }
    })

    this.renderMath()
  }

  renderMath() {
    const text = this.node.textContent
    if (!text) {
      this.renderDOM.innerHTML = '<div style="color: grey; opacity: 0.5;">Empty Math Block</div>'
      return
    }

    try {
      this.renderDOM.innerHTML = ''
      katex.render(text, this.renderDOM, {
        throwOnError: false,
        displayMode: true
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

  ignoreMutation(mutation: any): boolean {
    if (!this.contentDOM.contains(mutation.target)) {
      return true
    }
    return false
  }
}
