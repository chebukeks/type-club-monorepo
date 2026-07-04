import { Plugin, PluginKey } from 'prosemirror-state'

export const tableEditPluginKey = new PluginKey<number | null>('tableEditPlugin')

export function tableEditPlugin(): Plugin {
  return new Plugin<number | null>({
    key: tableEditPluginKey,
    state: {
      init() { return null },
      apply(tr, prev) {
        const meta = tr.getMeta(tableEditPluginKey)
        if (meta !== undefined) return meta
        if (tr.docChanged) return prev
        return prev
      },
    },
    props: {
      handleDOMEvents: {
        mousedown(view, event) {
          const editPos = tableEditPluginKey.getState(view.state)
          if (editPos == null) return false
          const clickPos = view.posAtDOM(event.target as Node, 0)
          const $click = view.state.doc.resolve(clickPos)
          for (let d = $click.depth; d > 0; d--) {
            if ($click.node(d).type.name === 'table' && $click.before(d) === editPos) {
              return false
            }
          }
          setTimeout(() => {
            if (!view.isDestroyed) {
              view.dispatch(view.state.tr.setMeta(tableEditPluginKey, null))
            }
          }, 0)
          return false
        },
        keydown(view, event) {
          if (event.key === 'Escape') {
            const editPos = tableEditPluginKey.getState(view.state)
            if (editPos != null) {
              view.dispatch(view.state.tr.setMeta(tableEditPluginKey, null))
              return true
            }
          }
          return false
        },
      },
    },
  })
}
