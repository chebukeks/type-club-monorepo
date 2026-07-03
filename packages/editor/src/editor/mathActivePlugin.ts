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
      if (!tr.selectionSet && !tr.docChanged && oldState.doc === newState.doc && !tr.getMeta('forceUpdate')) return oldDecos
      return buildDecorations(newState)
    }
  },
  props: {
    decorations(state) {
      return mathActiveKey.getState(state)
    },
    handleClick(view, pos, event) {
      const target = event.target as HTMLElement
      const renderEl = target.closest('.math-inline-render') as HTMLElement
      if (renderEl) {
        let clickPos = parseInt(renderEl.dataset.pos || '-1', 10)
        if (isNaN(clickPos)) clickPos = -1

        if (clickPos === -1) {
           try {
               const domPos = view.posAtDOM(renderEl, 0)
               if (domPos > 0) clickPos = domPos
           } catch (_) {}
        }

        if (clickPos > -1) {
          const tr = view.state.tr
          view.dispatch(tr.setSelection(TextSelection.create(view.state.doc, clickPos + 1)))
          return true
        }
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
      }
    }
    
    // Поддержка math_block
    if (node.type.name === 'math_block' && pos === activePos) {
      decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'is-active' }))
    }
  })

  return DecorationSet.create(state.doc, decos)
}
