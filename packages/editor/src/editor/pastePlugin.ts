/**
 * pastePlugin.ts — Умная вставка из буфера обмена
 *
 * Поведение зависит от того, что было скопировано:
 * 1. URL:
 *    - Если есть выделенный текст: оборачивает выделение в ссылку [текст](url).
 *    - Если вставка на пустой строке и это YouTube / картинка: вставляет embed (image node).
 *    - Если вставка внутри текста или обычный URL: вставляет как кликабельную ссылку.
 * 2. Raw Markdown (без text/html в буфере):
 *    - Текст автоматически парсится как Markdown, если содержит разметку или структуру.
 * 3. Блочные ноды (таблицы, изображения, блоки кода/математики, hr):
 *    - Вставляются отдельным блоком после текущего абзаца (или заменяют пустой).
 * 4. Обычные текстовые блоки из HTML:
 *    - Вливаются в текущий абзац без разрезания.
 */
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import { Slice, Fragment } from 'prosemirror-model'
import type { Node as PMNode } from 'prosemirror-model'
import type { EditorView } from 'prosemirror-view'
import { parseMarkdown } from './markdownConfig'
import { isVideoUrl } from './videoUtils'
import { htmlToMarkdown, isMeaningfulHtml } from './htmlToMarkdown'

export const pastePluginKey = new PluginKey('smartPaste')

/** Ноды, которые при вставке ведут себя как самостоятельные блоки */
export const BLOCK_PASTE_NODES = new Set([
  'table',
  'image',
  'code_block',
  'math_block',
  'horizontal_rule',
])

/** Проверка, является ли строка валидным HTTP(S) URL */
function isUrl(text: string): boolean {
  if (!text) return false
  const trimmed = text.trim()
  if (!/^https?:\/\/\S+$/i.test(trimmed)) return false
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** Проверка, ведёт ли URL на изображение по расширению файла */
function isImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname.toLowerCase()
    return /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(pathname)
  } catch {
    return false
  }
}

/** Закрытый slice, целиком состоящий из блочных нод из списка */
function isBlockSlice(slice: Slice): boolean {
  if (slice.openStart !== 0 || slice.openEnd !== 0 || slice.content.childCount === 0) return false
  let all = true
  slice.content.forEach((child) => {
    if (!BLOCK_PASTE_NODES.has(child.type.name)) all = false
  })
  return all
}

/** Закрытый slice из текста и ОДНОГО текстового блока — схлопываем в инлайн */
function isClosedTextSlice(slice: Slice): boolean {
  if (slice.openStart !== 0 || slice.openEnd !== 0 || slice.content.childCount === 0) return false
  let textblockCount = 0
  let nonMatching = false
  slice.content.forEach((child) => {
    if (BLOCK_PASTE_NODES.has(child.type.name)) nonMatching = true
    else if (child.isTextblock) textblockCount++
    else if (!child.isText) nonMatching = true
  })
  return !nonMatching && textblockCount === 1
}



/** Проверка: содержит ли текст явные маркеры Markdown-синтаксиса */
export function hasMarkdownSyntax(text: string): boolean {
  if (!text) return false

  // Fenced code blocks: ```lang ... ``` или ```
  if (/```[\s\S]*?```/.test(text) || /^```[a-zA-Z0-9_-]*\s*$/m.test(text)) return true

  // LaTeX math: $$...$$ или $...$
  if (/\$\$[\s\S]+?\$\$/.test(text)) return true
  if (/(?:^|\s)\$[^\$\n\s]+(?:\$[^\$\n\s]*)*\$(?:$|\s|[.,;:!?])/m.test(text)) return true

  // Markdown tables: | col | col |\n|---|---|
  if (/^\|[^\n]+\|\s*\r?\n\|[\s\-:|]+\|\s*\r?\n\|[^\n]+\|/m.test(text)) return true

  // Markdown headings: # Heading
  if (/^#{1,6}\s+\S/m.test(text)) return true

  // Task lists: - [ ] или - [x]
  if (/^[-*+]\s+\[[ xX]\]\s+/m.test(text)) return true

  // Spoilers: ||text||
  if (/\|\|[^|\n]+\|\|/.test(text)) return true

  // Highlights: ==text==
  if (/==[^=\n]+==/.test(text)) return true

  // Blockquotes: > quote
  if (/^>\s+\S/m.test(text)) return true

  // Markdown links / images: [text](url) или ![alt](url)
  if (/!?\[[^\]\n]+\]\((?:https?:\/\/[^\s)]+|[^\s)]+)\)/.test(text)) return true

  // Bold / Strikethrough markdown markers
  if (/\*\*[^*\n]+\*\*/.test(text) || /~~[^~\n]+~~/.test(text)) return true

  return false
}

/** Собрать текст из слайса в открытый параграф (1,1), сохраняя марки.
 *  Пустые/пробельные text-ноды по краям — артефакты сериализации — отбрасываем. */
function flattenToOpenSlice(slice: Slice, view: EditorView): Slice {
  const nodes: PMNode[] = []
  slice.content.forEach((child) => {
    if (child.isText) {
      if (child.text && child.text.trim().length > 0) nodes.push(child)
    } else if (child.isTextblock) {
      child.content.forEach((c: PMNode) => nodes.push(c))
    }
  })
  const schema = view.state.schema
  if (nodes.length === 0) {
    const text = slice.content.textBetween(0, slice.content.size).trim()
    if (text) nodes.push(schema.text(text))
  }
  const para = schema.node('paragraph', null, nodes)
  return Slice.maxOpen(Fragment.from(para))
}

function handleBlockPaste(view: EditorView, slice: Slice): boolean {
  const { state } = view
  if (!state.selection.empty) return false

  const tr = state.tr
  const { $head } = tr.selection
  let blockDepth = -1
  for (let d = $head.depth; d >= 1; d--) {
    const name = $head.node(d).type.name
    if (name === 'paragraph' || name === 'heading' || name === 'code_block' || name === 'math_block') {
      blockDepth = d
      break
    }
  }
  if (blockDepth === -1) return false

  const blockStart = $head.before(blockDepth)
  const blockEnd = $head.after(blockDepth)
  const isEmpty = $head.node(blockDepth).textContent.trim() === ''

  try {
    let insertEnd: number
    if (isEmpty) {
      tr.replaceWith(blockStart, blockEnd, slice.content)
      insertEnd = blockStart + slice.content.size
    } else {
      tr.insert(blockEnd, slice.content)
      insertEnd = blockEnd + slice.content.size
    }
    tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(insertEnd, tr.doc.content.size)), 1))
  } catch {
    return false
  }

  view.dispatch(tr.scrollIntoView())
  return true
}

export function pastePlugin(): Plugin {
  return new Plugin({
    key: pastePluginKey,
    props: {
      transformPasted(slice, view) {
        if (isClosedTextSlice(slice)) {
          return flattenToOpenSlice(slice, view)
        }
        return slice
      },
      handlePaste(view, event, slice) {
        const { state } = view
        const plainText = event.clipboardData?.getData('text/plain') ?? ''
        const trimmedText = plainText.trim()
        const htmlText = event.clipboardData?.getData('text/html') ?? ''

        if (!trimmedText) {
          if (isBlockSlice(slice)) {
            return handleBlockPaste(view, slice)
          }
          return false
        }

        // ─────────────────────────────────────────────────────────────
        // 0. Если курсор внутри блока кода или формулы — вставляем сырой текст
        // ─────────────────────────────────────────────────────────────
        const { $from } = state.selection
        let inRawBlock = false
        for (let d = $from.depth; d >= 1; d--) {
          const name = $from.node(d).type.name
          if (name === 'code_block' || name === 'math_block' || name === 'math_inline') {
            inRawBlock = true
            break
          }
        }
        if (inRawBlock) {
          const tr = state.tr.replaceSelectionWith(state.schema.text(plainText), false)
          view.dispatch(tr.scrollIntoView())
          return true
        }

        // ─────────────────────────────────────────────────────────────
        // 1. Вставка одиночного URL (ссылка, embed видео/картинки)
        // ─────────────────────────────────────────────────────────────
        if (isUrl(trimmedText)) {
          const url = trimmedText
          const { selection } = state

          // 1.a. Если есть выделенный текст: оборачиваем его в ссылку [текст](url)
          if (!selection.empty) {
            const { from, to } = selection
            const linkMark = state.schema.marks.link.create({ href: url })
            const tr = state.tr.addMark(from, to, linkMark)
            tr.setSelection(TextSelection.near(tr.doc.resolve(to)))
            view.dispatch(tr.scrollIntoView())
            return true
          }

          // 1.b. Если выделения нет: проверяем, находится ли курсор на пустой строке (абзаце)
          const { $head } = selection
          let blockDepth = -1
          for (let d = $head.depth; d >= 1; d--) {
            const name = $head.node(d).type.name
            if (name === 'paragraph' || name === 'heading') {
              blockDepth = d
              break
            }
          }

          const isParagraph = blockDepth !== -1 && $head.node(blockDepth).type.name === 'paragraph'
          const isBlankLine = isParagraph && $head.node(blockDepth).textContent.trim() === ''

          if (isBlankLine) {
            const isVideo = isVideoUrl(url)
            const isImage = isImageUrl(url)

            if (isVideo || isImage) {
              const imageNode = state.schema.nodes.image.create({ src: url })
              const blockStart = $head.before(blockDepth)
              const blockEnd = $head.after(blockDepth)
              const tr = state.tr.replaceWith(blockStart, blockEnd, imageNode)
              tr.setSelection(TextSelection.near(tr.doc.resolve(blockStart + imageNode.nodeSize), 1))
              view.dispatch(tr.scrollIntoView())
              return true
            }
          }

          // 1.c. Обычная ссылка в тексте (или на пустой строке, если не медиа)
          const linkMark = state.schema.marks.link.create({ href: url })
          const textNode = state.schema.text(url, [linkMark])
          const tr = state.tr.replaceSelectionWith(textNode, false)
          view.dispatch(tr.scrollIntoView())
          return true
        }

        // ─────────────────────────────────────────────────────────────
        // 2. Получение и парсинг Markdown:
        //    a. Если в буфере есть rich HTML (выделение с веб-страниц, AI-чатов, Google Docs):
        //       -> преобразуем HTML в чистый Markdown через htmlToMarkdown().
        //    b. Иначе (сырой Markdown, блокнот, код) используем plainText.
        // ─────────────────────────────────────────────────────────────
        let markdownToParse = ''

        if (htmlText && isMeaningfulHtml(htmlText)) {
          const converted = htmlToMarkdown(htmlText)
          if (converted) {
            markdownToParse = converted
          }
        }

        if (!markdownToParse) {
          markdownToParse = plainText
        }

        const parsedDoc = parseMarkdown(markdownToParse)
        if (parsedDoc && parsedDoc.childCount > 0) {
          const blockSlice = new Slice(parsedDoc.content, 0, 0)

          // Если это чисто блочные ноды (таблицы, hr, картинки, блоки кода и т.д.)
          if (isBlockSlice(blockSlice)) {
            return handleBlockPaste(view, blockSlice)
          }

          // Если это один абзац с инлайн-содержимым (вставляется инлайн без разрыва строки)
          if (parsedDoc.childCount === 1 && parsedDoc.firstChild?.type.name === 'paragraph') {
            const openSlice = Slice.maxOpen(parsedDoc.content)
            const tr = state.tr.replaceSelection(openSlice)
            view.dispatch(tr.scrollIntoView())
            return true
          }

          // Многострочный Markdown: если курсор на пустом параграфе — заменяем его целиком
          const { selection } = state
          const { $head } = selection
          let blockDepth = -1
          for (let d = $head.depth; d >= 1; d--) {
            const name = $head.node(d).type.name
            if (name === 'paragraph' || name === 'heading') {
              blockDepth = d
              break
            }
          }

          const isEmptyParagraph =
            selection.empty &&
            blockDepth !== -1 &&
            $head.node(blockDepth).type.name === 'paragraph' &&
            $head.node(blockDepth).textContent.trim() === ''

          if (isEmptyParagraph) {
            const blockStart = $head.before(blockDepth)
            const blockEnd = $head.after(blockDepth)
            const tr = state.tr.replaceWith(blockStart, blockEnd, parsedDoc.content)
            const insertEnd = blockStart + parsedDoc.content.size
            tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(insertEnd, tr.doc.content.size)), 1))
            view.dispatch(tr.scrollIntoView())
            return true
          }

          const tr = state.tr.replaceSelection(blockSlice)
          view.dispatch(tr.scrollIntoView())
          return true
        }

        // ─────────────────────────────────────────────────────────────
        // 3. Fallback: обработка HTML через ProseMirror (или блочный slice)
        // ─────────────────────────────────────────────────────────────
        if (isBlockSlice(slice)) {
          return handleBlockPaste(view, slice)
        }

        return false
      },
    },
  })
}
