import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { Node as PMNode } from 'prosemirror-model'
import { spellcheckService } from './spellcheckService'

export const spellcheckPluginKey = new PluginKey('spellcheck')

function getSpellcheckDecorations(doc: PMNode, uncachedWords?: Set<string>): DecorationSet {
  if (!spellcheckService.getEnabled()) {
    return DecorationSet.empty
  }

  const decorations: Decoration[] = []
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
          uncachedWords?.add(clean)
        }
      }
    }
  })

  return DecorationSet.create(doc, decorations)
}

export const spellcheckPlugin = new Plugin({
  key: spellcheckPluginKey,
  state: {
    init(_, instance) {
      return getSpellcheckDecorations(instance.doc)
    },
    apply(tr, oldDecorations, _oldState, newState) {
      if (tr.getMeta('spellcheckRefresh')) {
        return getSpellcheckDecorations(newState.doc)
      }
      return oldDecorations.map(tr.mapping, newState.doc)
    },
  },
  props: {
    decorations(state) {
      return this.getState(state)
    },
  },
  view(editorView) {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const scheduleCheck = (delay: number) => {
      if (debounceTimer) clearTimeout(debounceTimer)
      if (!spellcheckService.getProvider()) return
      debounceTimer = setTimeout(async () => {
        const uncachedWords = new Set<string>()
        getSpellcheckDecorations(editorView.state.doc, uncachedWords)
        await spellcheckService.checkWords([...uncachedWords])
        if (!editorView.isDestroyed) {
          editorView.dispatch(editorView.state.tr.setMeta('spellcheckRefresh', true))
        }
      }, delay)
    }

    const unsubscribe = spellcheckService.subscribe(() => {
      if (!editorView.isDestroyed) {
        editorView.dispatch(editorView.state.tr.setMeta('spellcheckRefresh', true))
        scheduleCheck(40)
      }
    })

    scheduleCheck(40)

    return {
      update(view, prevState) {
        if (!view.state.doc.eq(prevState.doc)) {
          scheduleCheck(350)
        }
      },
      destroy() {
        if (debounceTimer) clearTimeout(debounceTimer)
        unsubscribe()
      },
    }
  },
})
