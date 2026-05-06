import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { Node } from 'prosemirror-model'

export const focusModeKey = new PluginKey('focusMode')

export function focusModePlugin(getFocusMode: () => 'none' | 'paragraph' | 'sentence' | 'lines') {
  return new Plugin({
    key: focusModeKey,
    state: {
      init() {
        return DecorationSet.empty
      },
      apply(tr, oldSet, _oldState, newState) {
        // Проверяем, изменилось ли выделение или документ. Если пришла мета 'focusModeUpdate', тоже пересчитываем.
        if (!tr.docChanged && !tr.selectionSet && !tr.getMeta('focusModeUpdate')) {
          return oldSet
        }

        const mode = getFocusMode()
        if (mode === 'none' || mode === 'lines') return DecorationSet.empty

        const { head } = newState.selection
        const $head = newState.selection.$head
        const decos: Decoration[] = []

        // Находим top-level блок (прямой потомок doc, depth=1) — именно его нужно
        // пометить как активный, чтобы CSS `.ProseMirror > *:not(...)` работал корректно.
        // Это решает проблему со списками, таблицами, цитатами, math_block и т.д.
        if ($head.depth < 1) return DecorationSet.empty

        const topPos = $head.before(1)
        const topNode = $head.node(1)

        decos.push(Decoration.node(topPos, topPos + topNode.nodeSize, { class: 'focus-active-paragraph' }))

        if (mode === 'sentence') {
          // Для списков: проходим по ВСЕМ уровням вложенности list_item
          // и приглушаем sibling'ов на каждом уровне + вложенный контент,
          // не содержащий каретку.
          for (let d = $head.depth; d > 1; d--) {
            const node = $head.node(d)
            if (node.type.name !== 'list_item') continue

            const listItemPos = $head.before(d)
            const parentList = $head.node(d - 1)
            const parentListPos = $head.before(d - 1)

            // Приглушаем все sibling list_item на этом уровне
            parentList.forEach((child, childOffset) => {
              const childPos = parentListPos + 1 + childOffset
              if (childPos !== listItemPos) {
                decos.push(Decoration.node(childPos, childPos + child.nodeSize, { class: 'focus-dimmed' }))
              }
            })

            // Внутри активного list_item — приглушаем вложенные блоки,
            // которые не содержат каретку (например, вложенные списки)
            node.forEach((child, childOffset) => {
              const childPos = listItemPos + 1 + childOffset
              const childEnd = childPos + child.nodeSize
              if (!child.isTextblock && (head < childPos || head >= childEnd)) {
                decos.push(Decoration.node(childPos, childEnd, { class: 'focus-dimmed' }))
              }
            })
          }

          // Ищем ближайший текстовый блок (может быть вложен: list_item > paragraph)
          let activeDivPos = -1
          let activeDivNode: Node | null = null

          newState.doc.nodesBetween(topPos, topPos + topNode.nodeSize, (node, pos) => {
            if (node.isTextblock && pos <= head && pos + node.nodeSize >= head) {
              activeDivPos = pos
              activeDivNode = node
              return false
            }
            return true
          })

          if (activeDivNode) {
            const node = activeDivNode as Node
            const text = node.textContent
            const relativeHead = head - activeDivPos - 1
            
            let start = 0
            let end = text.length
            
            // Простой поиск окончаний предложений
            const matches = [...text.matchAll(/([.!?])[\s\n]/g)]
            
            for (let i = 0; i < matches.length; i++) {
              const matchIndex = matches[i].index! + 1 // Включая сам знак препинания
              if (matchIndex < relativeHead) {
                start = matchIndex + 1 // Начинаем следующее предложение с пробела
              } else if (matchIndex >= relativeHead && end === text.length) {
                end = matchIndex
              }
            }
            
            // Всё, что ДО текущего предложения — приглушаем
            if (start > 0) {
              decos.push(Decoration.inline(activeDivPos + 1, activeDivPos + 1 + start, { class: 'focus-dimmed' }))
            }
            // Всё, что ПОСЛЕ текущего предложения — приглушаем
            if (end < text.length) {
              decos.push(Decoration.inline(activeDivPos + 1 + end, activeDivPos + node.nodeSize - 1, { class: 'focus-dimmed' }))
            }
          }
        }

        return DecorationSet.create(newState.doc, decos)
      }
    },
    props: {
      decorations(state) {
        return this.getState(state)
      }
    }
  })
}
