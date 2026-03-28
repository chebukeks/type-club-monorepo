import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { NodeSelection } from 'prosemirror-state'

const mathActiveKey = new PluginKey('mathActive')

/**
 * Плагин следит за позицией курсора и добавляет декоративный класс `is-active`
 * к математическим узлам (`math_inline` и `math_block`), если они в фокусе.
 */
export const mathActivePlugin = new Plugin({
  key: mathActiveKey,
  state: {
    init() {
      return DecorationSet.empty
    },
    apply(tr, oldDecos, _oldState, newState) {
      if (!tr.selectionSet && !tr.docChanged) return oldDecos

      const decos: Decoration[] = []
      const { selection } = newState

      // Находим всё дерево узлов вокруг курсора
      let activePos = -1
      let activeSize = 0

      if (selection instanceof NodeSelection) {
        if (selection.node.type.name.startsWith('math_')) {
          activePos = selection.from
          activeSize = selection.node.nodeSize
        }
      } else {
        // TextSelection: ищем вверх по дереву
        for (let d = selection.$from.depth; d > 0; d--) {
          const node = selection.$from.node(d)
          if (node.type.name.startsWith('math_')) {
            activePos = selection.$from.before(d)
            activeSize = node.nodeSize
            break
          }
        }
      }

      if (activePos !== -1) {
        // Добавляем класс 'is-active' на обертку ноды
        decos.push(Decoration.node(activePos, activePos + activeSize, { class: 'is-active' }))
      }

      return DecorationSet.create(newState.doc, decos)
    }
  },
  props: {
    decorations(state) {
      return mathActiveKey.getState(state)
    }
  }
})
