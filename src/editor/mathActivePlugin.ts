import { Plugin, PluginKey, NodeSelection, TextSelection } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import katex from 'katex'

const mathActiveKey = new PluginKey('mathActive')

/**
 * Плагин добавляет `is-active` / `is-inactive` и рендерит виджеты KaTeX для math_inline.
 */
export const mathActivePlugin = new Plugin({
  key: mathActiveKey,
  state: {
    init(_, state) {
      return buildDecorations(state)
    },
    apply(tr, oldDecos, oldState, newState) {
      if (!tr.selectionSet && !tr.docChanged && oldState.doc === newState.doc) return oldDecos
      return buildDecorations(newState)
    }
  },
  props: {
    decorations(state) {
      return mathActiveKey.getState(state)
    },
    handleClick(view, pos, event) {
      const target = event.target as HTMLElement
      console.log('[mathActivePlugin] handleClick activated. Click pos:', pos, 'target:', target)
      
      const renderEl = target.closest('.math-inline-render') as HTMLElement
      if (renderEl) {
        process.env.NODE_ENV === 'development' && console.log('[mathActivePlugin] Found .math-inline-render!', renderEl)
        let clickPos = parseInt(renderEl.dataset.pos || '-1', 10)
        
        // Попробуем получить позицию через view.posAtDOM как резервный вариант
        if (clickPos === -1) {
           try {
              const domPos = view.posAtDOM(renderEl, 0)
              if (domPos > 0) clickPos = domPos
           } catch (e) {
              console.warn('[mathActivePlugin] error getting posAtDOM:', e)
           }
        }
        
        process.env.NODE_ENV === 'development' && console.log('[mathActivePlugin] click target evaluated pos:', clickPos)
        
        if (clickPos > -1) {
          const tr = view.state.tr
          
          process.env.NODE_ENV === 'development' && console.log('[mathActivePlugin] Setting selection to start editing at pos:', clickPos + 1)
          view.dispatch(tr.setSelection(TextSelection.create(view.state.doc, clickPos + 1)))
          return true
        }
      } else {
        process.env.NODE_ENV === 'development' && console.log('[mathActivePlugin] Target is NOT math-inline-render. closest() returned null.')
      }
      return false
    }
  }
})

function buildDecorations(state: any): DecorationSet {
  const decos: Decoration[] = []
  const { selection } = state

  let activePos = -1
  if (selection instanceof NodeSelection) {
    if (selection.node.type.name.startsWith('math_')) {
      activePos = selection.from
    }
  } else {
    for (let d = selection.$from.depth; d > 0; d--) {
      const node = selection.$from.node(d)
      if (node.type.name.startsWith('math_')) {
        activePos = selection.$from.before(d)
        break
      }
    }
  }

  state.doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'math_inline') {
      const isActive = pos === activePos
      
      if (isActive) {
        decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'is-active' }))
        
        // Tooltip Widget
        const renderTooltip = () => {
          const anchor = document.createElement('span')
          anchor.className = 'math-inline-tooltip-anchor'

          const tooltip = document.createElement('div')
          tooltip.className = 'math-inline-tooltip'
          const text = node.textContent?.trim() || ''
          
          if (!text) {
             tooltip.innerHTML = '<span style="color: grey; opacity: 0.5;">Empty Math</span>'
          } else {
             try {
                katex.render(text, tooltip, { throwOnError: false, displayMode: false })
             } catch (e) {
                tooltip.textContent = text
             }
          }
          
          anchor.appendChild(tooltip)
          return anchor
        }
        
        decos.push(Decoration.widget(pos + node.nodeSize, renderTooltip, { side: 1, ignoreSelection: true }))
      } else {
        decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'is-inactive' }))
        
        // Inline render Widget
        const renderInline = () => {
          const span = document.createElement('span')
          span.className = 'math-inline-render'
          span.dataset.pos = String(pos) // Сохраняем реальную позицию для клика
          
          const text = node.textContent?.trim() || ''
          
          if (!text) {
             span.innerHTML = '<span style="color: grey; opacity: 0.5;">Empty Math</span>'
          } else {
             try {
                katex.render(text, span, { throwOnError: false, displayMode: false })
             } catch (e) {
                span.textContent = text
             }
          }
          return span
        }
        
        decos.push(Decoration.widget(pos + node.nodeSize, renderInline, { side: 1, ignoreSelection: true }))
      }
    }
    
    // Поддержка math_block
    if (node.type.name === 'math_block' && pos === activePos) {
      decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'is-active' }))
    }
  })

  return DecorationSet.create(state.doc, decos)
}
