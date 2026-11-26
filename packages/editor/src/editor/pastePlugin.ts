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
import { Plugin, PluginKey, TextSelection, type Transaction } from 'prosemirror-state'
import { Slice, Fragment } from 'prosemirror-model'
import type { Node as PMNode, ResolvedPos } from 'prosemirror-model'
import type { EditorView } from 'prosemirror-view'
import { parseMarkdown } from './markdownConfig'
import { isVideoUrl } from './videoUtils'
import { htmlToMarkdown, isMeaningfulHtml } from './htmlToMarkdown'
import { PASTE_IMAGE_FILES_EVENT, type PasteImageFilesDetail } from './imageInsert'

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

/** Картинки-файлы из буфера обмена (копирование файла в проводнике, «Копировать изображение» и т.п.) */
function getClipboardImageFiles(event: ClipboardEvent): File[] {
  const cd = event.clipboardData
  if (!cd) return []
  const files = Array.from(cd.files ?? []).filter((f) => f.type.startsWith('image/'))
  if (files.length > 0) return files
  const result: File[] = []
  for (const item of Array.from(cd.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile()
      if (f) result.push(f)
    }
  }
  return result
}

/** HTML состоит только из <img> с нерезолвимым src (например, Discord кладёт src="image.png") */
function hasOnlyUnresolvableImages(html: string): boolean {
  if (!html) return false
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const imgs = Array.from(doc.querySelectorAll('img'))
    if (imgs.length === 0) return false
    return imgs.every((img) => {
      const src = (img.getAttribute('src') || '').trim()
      return !/^(https?:|data:|blob:|\/)/i.test(src)
    })
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

function isRawPasteContext($pos: ResolvedPos): boolean {
  for (let depth = $pos.depth; depth >= 1; depth--) {
    const name = $pos.node(depth).type.name
    if (name === 'code_block' || name === 'math_block' || name === 'math_inline') return true
  }
  return false
}

function pasteUrl(view: EditorView, url: string, tr = view.state.tr): boolean {
  const { schema } = view.state
  const { selection } = tr
  if (!selection.empty) {
    tr.addMark(selection.from, selection.to, schema.marks.link.create({ href: url }))
    tr.setSelection(TextSelection.near(tr.doc.resolve(selection.to)))
  } else {
    const { $head } = selection
    if ($head.parent.type.name === 'paragraph' && !$head.parent.textContent.trim() &&
        (isVideoUrl(url) || isImageUrl(url))) {
      const image = schema.nodes.image.create({ src: url })
      const start = $head.before()
      tr.replaceWith(start, $head.after(), image)
      tr.setSelection(TextSelection.near(tr.doc.resolve(start + image.nodeSize), 1))
    } else {
      tr.replaceSelectionWith(schema.text(url, [schema.marks.link.create({ href: url })]), false)
    }
  }
  view.dispatch(tr.scrollIntoView())
  return true
}

function pasteContent(view: EditorView, plainText: string, htmlText: string, slice: Slice): boolean {
  const { state } = view
  const trimmedText = plainText.trim()
  if (!trimmedText) return isBlockSlice(slice) && handleBlockPaste(view, slice)

  if (isRawPasteContext(state.selection.$from)) {
    const tr = state.tr.replaceSelectionWith(state.schema.text(plainText), false)
    view.dispatch(tr.scrollIntoView())
    return true
  }

  if (isUrl(trimmedText)) return pasteUrl(view, trimmedText)

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
      handleDOMEvents: {
        beforeinput(view, event) {
          if (!view.editable || !event.cancelable || event.isComposing) return false
          const type = event.inputType
          const explicitPaste = type === 'insertFromPaste'
          if (!explicitPaste && type !== 'insertText' && type !== 'insertReplacementText') return false
          if (event.dataTransfer?.files.length) return false

          const text = event.data ?? event.dataTransfer?.getData('text/plain') ?? ''
          // Keyboard clipboards can commit a whole URL as ordinary text input.
          if (!text || (!explicitPaste && !isUrl(text) && !(/[\r\n]/.test(text) && hasMarkdownSyntax(text)))) return false
          const html = explicitPaste ? event.dataTransfer?.getData('text/html') ?? '' : ''
          if (!pasteContent(view, text, html, Slice.empty)) return false
          event.preventDefault()
          return true
        },
      },
      handleTextInput(view, from, to, text) {
        const url = text.trim()
        if (!view.editable || view.composing || !isUrl(url)) return false
        const { doc } = view.state
        const $from = doc.resolve(from)
        if (isRawPasteContext($from)) return false

        // Some IMEs only report the inserted text after the DOM has changed.
        const tr: Transaction = view.state.tr.setSelection(TextSelection.between($from, doc.resolve(to)))
        return pasteUrl(view, url, tr)
      },
      handlePaste(view, event, slice) {
        const plainText = event.clipboardData?.getData('text/plain') ?? ''
        const trimmedText = plainText.trim()
        const htmlText = event.clipboardData?.getData('text/html') ?? ''

        // ─────────────────────────────────────────────────────────────
        // -1. Картинка-файл в буфере (без осмысленного текста): отдаём приложению.
        //     Приложение само загрузит файл на сервер (онлайн-статья) или встроит base64.
        // ─────────────────────────────────────────────────────────────
        const imageFiles = getClipboardImageFiles(event)
        if (imageFiles.length > 0 && (!trimmedText || !htmlText || !isMeaningfulHtml(htmlText))) {
          event.preventDefault()
          const detail: PasteImageFilesDetail = { files: imageFiles }
          if (htmlText) {
            const html = new DOMParser().parseFromString(htmlText, 'text/html')
            const images = Array.from(html.querySelectorAll('img'))
            if (images.length === imageFiles.length) {
              detail.altTexts = images.map((image) => image.getAttribute('alt')?.trim() || null)
            }
          }
          window.dispatchEvent(
            new CustomEvent(PASTE_IMAGE_FILES_EVENT, { detail }),
          )
          return true
        }

        // Битая картинка без файла (src="image.png"): не вставляем «сломанную» ноду
        if (!trimmedText && hasOnlyUnresolvableImages(htmlText)) {
          return true
        }

        return pasteContent(view, plainText, htmlText, slice)
      },
    },
  })
}
