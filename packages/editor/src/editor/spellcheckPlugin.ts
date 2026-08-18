import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { Node as PMNode } from 'prosemirror-model'
import type { EditorView } from 'prosemirror-view'
import { spellcheckService } from './spellcheckService'

export const spellcheckPluginKey = new PluginKey('spellcheck')

let checkDebounceTimer: ReturnType<typeof setTimeout> | null = null

function getSpellcheckDecorations(doc: PMNode, view?: EditorView): DecorationSet {
  if (!spellcheckService.getEnabled()) {
    return DecorationSet.empty
  }

  const decorations: Decoration[] = []
  const uncachedWords: string[] = []
  const wordRegex = /[\p{L}\p{N}'_-]+/gu

  doc.descendants((node, pos) => {
    if (
      node.type.name === 'code_block' ||
      node.type.name === 'math_block' ||
      node.type.name === 'math_inline' ||
      node.type.name === 'image'
    ) {
      return false
    }

    if (node.isText && node.text) {
      const text = node.text
      let match: RegExpExecArray | null

      wordRegex.lastIndex = 0

      while ((match = wordRegex.exec(text)) !== null) {
        const rawWord = match[0]
        const clean = rawWord.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/u, '')
        if (!clean || clean.length <= 1) continue

        const cachedStatus = spellcheckService.isWordMisspelledCached(clean)
        if (cachedStatus === true) {
          const wordStartInMatch = rawWord.indexOf(clean)
          const start = pos + match.index + (wordStartInMatch >= 0 ? wordStartInMatch : 0)
          const end = start + clean.length

          decorations.push(
            Decoration.inline(start, end, {
              class: 'spelling-error',
              'data-misspelled-word': clean,
            })
          )
        } else if (cachedStatus === undefined) {
          uncachedWords.push(clean)
        }
      }
    }
  })

  // Асинхронная фоновая пакетная проверка неизвестных слов
  if (uncachedWords.length > 0 && view) {
    if (checkDebounceTimer) clearTimeout(checkDebounceTimer)
    checkDebounceTimer = setTimeout(async () => {
      const unique = Array.from(new Set(uncachedWords))
      await spellcheckService.checkWords(unique)
      if (view && !view.isDestroyed) {
        view.dispatch(view.state.tr.setMeta('spellcheckRefresh', true))
      }
    }, 40)
  }

  return DecorationSet.create(doc, decorations)
}

export const spellcheckPlugin = new Plugin({
  key: spellcheckPluginKey,
  state: {
    init(_, instance) {
      return getSpellcheckDecorations(instance.doc)
    },
    apply(tr, oldDecorations, _oldState, newState) {
      if (tr.getMeta('spellcheckRefresh') || tr.docChanged) {
        return getSpellcheckDecorations(newState.doc)
      }
      return oldDecorations.map(tr.mapping, tr.doc)
    },
  },
  props: {
    decorations(state) {
      return this.getState(state)
    },
  },
  view(editorView) {
    // Подписываемся на изменения словарей для мгновенного обновления
    const unsubscribe = spellcheckService.subscribe(() => {
      if (editorView && !editorView.isDestroyed) {
        editorView.dispatch(editorView.state.tr.setMeta('spellcheckRefresh', true))
      }
    })

    // Первичная проверка при монтировании
    getSpellcheckDecorations(editorView.state.doc, editorView)

    return {
      update(view) {
        getSpellcheckDecorations(view.state.doc, view)
      },
      destroy() {
        unsubscribe()
      },
    }
  },
})
