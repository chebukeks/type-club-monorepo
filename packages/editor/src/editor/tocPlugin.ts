import { Plugin } from 'prosemirror-state'
import type { TocItem, SuggestionItem } from '../types'

/**
 * Плагин для извлечения оглавления (TOC) и предложений из документа.
 * При изменении документа сканирует заголовки и предложения и вызывает onUpdate.
 */
export function tocPlugin(onUpdate: (toc: TocItem[], suggestions: SuggestionItem[]) => void) {
  return new Plugin({
    view(editorView) {
      let timer: ReturnType<typeof setTimeout> | null = null

      const scanToc = (view: any) => {
        const tempToc: TocItem[] = []
        const tempSuggestions: SuggestionItem[] = []
        let index = 0
        let currentGroup: {
          id: string
          type: 'insert' | 'delete'
          authorName: string
          text: string
          pos: number
          toPos: number
        } | null = null

        const pushGroup = () => {
          if (currentGroup) {
            tempSuggestions.push(currentGroup)
            currentGroup = null
          }
        }

        view.state.doc.descendants((node: any, pos: number) => {
          if (node.type.name === 'heading') {
            const text = node.textContent
            const level = node.attrs.level as number
            const id = `toc-${level}-${index++}-${text.substring(0, 10).replace(/\s+/g, '-')}`
            tempToc.push({ id, text, level, pos })
          }

          if (node.type.name === 'suggestion_note') {
            pushGroup()
            tempSuggestions.push({
              id: node.attrs.noteId || `note-${pos}`,
              type: 'note',
              authorName: node.attrs.sugAuthorName || 'Советчик',
              text: node.attrs.noteText || '',
              pos,
              toPos: pos + node.nodeSize,
            })
            return false
          }

          if (node.isText) {
            const insertMark = node.marks.find((m: any) => m.type.name === 'suggestion_insert')
            const deleteMark = node.marks.find((m: any) => m.type.name === 'suggestion_delete')
            const sugMark = insertMark || deleteMark
            const sugType = insertMark ? 'insert' : deleteMark ? 'delete' : null

            if (sugMark && sugType) {
              const odId = sugMark.attrs.odId || `${sugType}-${pos}`
              const authorName = sugMark.attrs.sugAuthorName || 'Советчик'

              if (
                currentGroup &&
                currentGroup.type === sugType &&
                currentGroup.id === odId &&
                pos === currentGroup.toPos
              ) {
                currentGroup.text += node.text
                currentGroup.toPos = pos + node.nodeSize
              } else {
                pushGroup()
                currentGroup = {
                  id: odId,
                  type: sugType,
                  authorName,
                  text: node.text || '',
                  pos,
                  toPos: pos + node.nodeSize,
                }
              }
            } else {
              pushGroup()
            }
          } else {
            pushGroup()
          }

          return true
        })

        pushGroup()
        onUpdate(tempToc, tempSuggestions)
      }

      // Initial scan
      scanToc(editorView)

      return {
        update(view, prevState) {
          if (!view.state.doc.eq(prevState.doc)) {
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => {
              scanToc(view)
            }, 300)
          }
        },
        destroy() {
          if (timer) clearTimeout(timer)
        },
      }
    }
  })
}
