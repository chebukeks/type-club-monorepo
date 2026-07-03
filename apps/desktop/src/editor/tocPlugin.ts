import { Plugin } from 'prosemirror-state'
import type { TocItem } from '../types'

/**
 * Плагин для извлечения оглавления (TOC) из документа.
 * Экспортирует функцию, создающую плагин, который при изменении документа
 * сканирует заголовки и вызывает onUpdate.
 */
export function tocPlugin(onUpdate: (toc: TocItem[]) => void) {
  return new Plugin({
    view(editorView) {
      const scanToc = (view: any) => {
        const tempToc: TocItem[] = []
        let index = 0
        view.state.doc.descendants((node: any, pos: number) => {
          if (node.type.name === 'heading') {
            const text = node.textContent
            const level = node.attrs.level as number
            const id = `toc-${level}-${index++}-${text.substring(0, 10).replace(/\\s+/g, '-')}`
            tempToc.push({ id, text, level, pos })
          }
          return true
        })
        onUpdate(tempToc)
      }

      // Initial scan
      scanToc(editorView)

      return {
        update(view, prevState) {
          if (!view.state.doc.eq(prevState.doc)) {
            scanToc(view)
          }
        }
      }
    }
  })
}
