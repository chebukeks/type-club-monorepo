import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export const foldingPluginKey = new PluginKey('folding')

export const foldingPlugin = new Plugin({
  key: foldingPluginKey,
  state: {
    init() {
      return new Set<number>()
    },
    apply(tr, value) {
      const nextValue = new Set<number>()
      value.forEach(pos => {
        const nextPos = tr.mapping.map(pos)
        if (tr.doc.nodeAt(nextPos)?.type.name === 'heading') {
          nextValue.add(nextPos)
        }
      })

      const togglePos = tr.getMeta('toggleFold')
      if (typeof togglePos === 'number') {
        if (nextValue.has(togglePos)) {
          nextValue.delete(togglePos)
        } else {
          nextValue.add(togglePos)
        }
      }
      return nextValue
    }
  },
  props: {
    decorations(state) {
      const foldedPosList = foldingPluginKey.getState(state) as Set<number>
      const decos: Decoration[] = []

      let currentFoldLevel = 100 

      state.doc.forEach((node, offset) => {
        if (node.type.name === 'heading') {
          const level = node.attrs.level as number
          if (level <= currentFoldLevel) {
            currentFoldLevel = 100
          }
          
          if (foldedPosList.has(offset)) {
            decos.push(Decoration.node(offset, offset + node.nodeSize, { class: 'is-folded' }))
            if (level < currentFoldLevel) {
               currentFoldLevel = level
            }
          } else if (currentFoldLevel < 100) {
             decos.push(Decoration.node(offset, offset + node.nodeSize, { class: 'folded-content' }))
          }
        } else {
          if (currentFoldLevel < 100) {
             decos.push(Decoration.node(offset, offset + node.nodeSize, { class: 'folded-content' }))
          }
        }
      })

      return DecorationSet.create(state.doc, decos)
    }
  }
})
