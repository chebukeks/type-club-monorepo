import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { Node as PMNode } from 'prosemirror-model'
import hljs from 'highlight.js/lib/core'

import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import html from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import sql from 'highlight.js/lib/languages/sql'
import markdown from 'highlight.js/lib/languages/markdown'

// Регистрируем часто используемые языки для экономии бандла
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('html', html)
hljs.registerLanguage('xml', html)
hljs.registerLanguage('css', css)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)

export const syntaxHighlightKey = new PluginKey('syntaxHighlight')

/**
 * Проходит по DOM-дереву (полученному из highlight.js)
 * и маппит классы на ProseMirror Decorations.
 */
function parseDecorationsFromDOM(
  domNode: Node,
  startPos: number,
  decorations: Decoration[]
): number {
  let currentPos = startPos

  domNode.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      // Это просто текст, сдвигаем указатель
      currentPos += child.textContent?.length || 0
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const element = child as HTMLElement
      const start = currentPos
      
      // Рекурсивно обрабатываем детей
      currentPos = parseDecorationsFromDOM(element, currentPos, decorations)
      
      // Если у элемента есть классы, создаем декорацию на всю его длину
      const className = element.className
      if (className) {
        decorations.push(Decoration.inline(start, currentPos, { class: className }))
      }
    }
  })

  return currentPos
}

function getHighlightDecorations(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = []

  doc.descendants((node, pos) => {
    if (node.type.name === 'code_block') {
      const language = node.attrs.params || ''
      const text = node.textContent

      if (!text) return false

      let htmlString = ''
      try {
        if (language && hljs.getLanguage(language)) {
          htmlString = hljs.highlight(text, { language, ignoreIllegals: true }).value
        } else {
          // Если язык неизвестен или не указан, пытаемся определить автоматически
          htmlString = hljs.highlightAuto(text).value
        }
      } catch (err) {
        console.warn('Highlight js error:', err)
        return false
      }

      // Парсим HTML безопасно через DOMParser
      const parser = new DOMParser()
      const htmlDoc = parser.parseFromString(htmlString, 'text/html')
      
      // Обходим сгенерированный DOM и создаем Decorations
      // pos + 1 — это начало текста внутри code_block ноды
      parseDecorationsFromDOM(htmlDoc.body, pos + 1, decorations)

      return false
    }
  })

  return DecorationSet.create(doc, decorations)
}

export const syntaxHighlightPlugin = new Plugin({
  key: syntaxHighlightKey,
  state: {
    init(_, instance) {
      return getHighlightDecorations(instance.doc)
    },
    apply(tr, oldDecorations, _oldState, newState) {
      // Пересчитываем только если документ изменился
      if (!tr.docChanged) return oldDecorations
      return getHighlightDecorations(newState.doc)
    },
  },
  props: {
    decorations(state) {
      return this.getState(state)
    },
  },
})
