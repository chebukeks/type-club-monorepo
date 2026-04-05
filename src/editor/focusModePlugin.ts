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
        const decos: Decoration[] = []

        let activeDivPos = -1
        let activeDivNode: Node | null = null

        // Ищем активный текстовый блок (абзац, заголовок и т.д.)
        newState.doc.nodesBetween(0, newState.doc.content.size, (node, pos) => {
          if (node.isTextblock && pos <= head && pos + node.nodeSize >= head) {
            activeDivPos = pos
            activeDivNode = node
            return false // Останавливаем обход внутри узла
          }
          return true
        })

        if (!activeDivNode) return DecorationSet.empty
        
        const node = activeDivNode as Node

        // Если это абзац (или любой TextBlock)
        if (mode === 'paragraph' || mode === 'sentence') {
          decos.push(Decoration.node(activeDivPos, activeDivPos + node.nodeSize, { class: 'focus-active-paragraph' }))
        } 
        
        if (mode === 'sentence') {
          // Ищем границы предложения
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
