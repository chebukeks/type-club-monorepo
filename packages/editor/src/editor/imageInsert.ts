/**
 * imageInsert.ts — вставка картинок из буфера обмена / файлов.
 *
 * Плагин вставки (pastePlugin) не загружает файлы сам: он диспатчит событие
 * PASTE_IMAGE_FILES_EVENT, а приложение (web/desktop) решает, что делать:
 * для онлайн-статьи сначала загрузить файл на сервер и вставить только URL
 * (base64 в Yjs-документе превышает лимит сообщения коллаб-сервера и рвёт соединение).
 */
import { TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

export const PASTE_IMAGE_FILES_EVENT = 'editor-paste-image-files'

export interface PasteImageFilesDetail {
  files: File[]
}

/** Вставляет image-ноду отдельным блоком в позицию курсора и ставит курсор в абзац после неё. */
export function insertImageNode(view: EditorView, src: string, alt: string | null = 'image'): void {
  const { state, dispatch } = view
  const imageType = state.schema.nodes.image
  if (!imageType) return

  const { $head } = state.selection
  let blockDepth = -1
  for (let d = $head.depth; d >= 1; d--) {
    const name = $head.node(d).type.name
    if (name === 'paragraph' || name === 'heading' || name === 'code_block' || name === 'math_block') {
      blockDepth = d
      break
    }
  }

  const imageNode = imageType.create({ src, alt })
  const tr = state.tr
  let targetPos = state.selection.from

  if (blockDepth !== -1) {
    const isEmpty = $head.node(blockDepth).textContent.trim() === ''
    const blockStart = $head.before(blockDepth)
    const blockEnd = $head.after(blockDepth)
    if (isEmpty) {
      tr.replaceWith(blockStart, blockEnd, imageNode)
      targetPos = blockStart
    } else {
      tr.insert(blockEnd, imageNode)
      targetPos = blockEnd
    }
  } else {
    tr.insert(targetPos, imageNode)
  }

  const newPos = targetPos + imageNode.nodeSize
  const p = state.schema.nodes.paragraph.createAndFill()!
  tr.insert(newPos, p)
  tr.setSelection(TextSelection.near(tr.doc.resolve(newPos + 1)))

  dispatch(tr.scrollIntoView())
  view.focus()
}
