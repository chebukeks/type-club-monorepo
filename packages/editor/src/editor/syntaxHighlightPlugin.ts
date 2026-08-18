import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { Node as PMNode } from 'prosemirror-model'
import hljs from 'highlight.js/lib/core'

import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import html from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import yaml from 'highlight.js/lib/languages/yaml'
import bash from 'highlight.js/lib/languages/bash'
import sql from 'highlight.js/lib/languages/sql'
import markdown from 'highlight.js/lib/languages/markdown'
import ini from 'highlight.js/lib/languages/ini'
import properties from 'highlight.js/lib/languages/properties'
import diff from 'highlight.js/lib/languages/diff'
import kotlin from 'highlight.js/lib/languages/kotlin'
import dockerfile from 'highlight.js/lib/languages/dockerfile'

// Регистрируем часто используемые языки
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('java', java)
hljs.registerLanguage('c', c)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('c++', cpp)
hljs.registerLanguage('csharp', csharp)
hljs.registerLanguage('cs', csharp)
hljs.registerLanguage('go', go)
hljs.registerLanguage('golang', go)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('rs', rust)
hljs.registerLanguage('html', html)
hljs.registerLanguage('xml', html)
hljs.registerLanguage('css', css)
hljs.registerLanguage('json', json)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('yml', yaml)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('zsh', bash)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)
hljs.registerLanguage('ini', ini)
hljs.registerLanguage('properties', properties)
hljs.registerLanguage('diff', diff)
hljs.registerLanguage('kotlin', kotlin)
hljs.registerLanguage('kt', kotlin)
hljs.registerLanguage('dockerfile', dockerfile)
hljs.registerLanguage('docker', dockerfile)

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
      currentPos += child.textContent?.length || 0
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const element = child as HTMLElement
      const start = currentPos
      currentPos = parseDecorationsFromDOM(element, currentPos, decorations)
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
  const tempDiv = document.createElement('div')

  doc.descendants((node, pos) => {
    if (node.type.name === 'code_block') {
      const language = (node.attrs.params || '').trim().toLowerCase()
      const text = node.textContent

      if (!text) return false

      let htmlString = ''
      try {
        if (language && hljs.getLanguage(language)) {
          htmlString = hljs.highlight(text, { language, ignoreIllegals: true }).value
        } else if (!language || language === 'text' || language === 'plain' || language === 'plaintext') {
          return false
        } else if (text.length < 400) {
          // Если язык неизвестен, пробуем авто-определение только для коротких сниппетов
          htmlString = hljs.highlightAuto(text).value
        } else {
          return false
        }
      } catch (err) {
        console.warn('Highlight js error:', err)
        return false
      }

      if (!htmlString) return false

      tempDiv.innerHTML = htmlString
      parseDecorationsFromDOM(tempDiv, pos + 1, decorations)
      tempDiv.textContent = ''

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
    apply(tr, oldDecorations, oldState, newState) {
      if (!tr.docChanged) return oldDecorations

      // Проверяем, затронули ли изменения хоть один code_block
      let codeBlockTouched = false
      for (const step of tr.steps) {
        step.getMap().forEach((oldStart, oldEnd, newStart, newEnd) => {
          if (codeBlockTouched) return
          const $oldStart = oldState.doc.resolve(Math.min(oldStart, oldState.doc.content.size))
          const $oldEnd = oldState.doc.resolve(Math.min(oldEnd, oldState.doc.content.size))
          if (
            $oldStart.parent.type.name === 'code_block' ||
            $oldEnd.parent.type.name === 'code_block' ||
            $oldStart.nodeAfter?.type.name === 'code_block' ||
            $oldEnd.nodeBefore?.type.name === 'code_block'
          ) {
            codeBlockTouched = true
            return
          }
          const $newStart = newState.doc.resolve(Math.min(newStart, newState.doc.content.size))
          const $newEnd = newState.doc.resolve(Math.min(newEnd, newState.doc.content.size))
          if (
            $newStart.parent.type.name === 'code_block' ||
            $newEnd.parent.type.name === 'code_block' ||
            $newStart.nodeAfter?.type.name === 'code_block' ||
            $newEnd.nodeBefore?.type.name === 'code_block'
          ) {
            codeBlockTouched = true
            return
          }
        })
        if (codeBlockTouched) break
      }

      if (!codeBlockTouched) {
        return oldDecorations.map(tr.mapping, newState.doc)
      }

      return getHighlightDecorations(newState.doc)
    },
  },
  props: {
    decorations(state) {
      return this.getState(state)
    },
  },
})
