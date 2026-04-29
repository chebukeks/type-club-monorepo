/**
 * SearchBar.tsx — Поиск по документу (Ctrl+F).
 * Плавающая панель поверх редактора с подсветкой совпадений.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { EditorView } from 'prosemirror-view'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

// ============================================================
// ProseMirror плагин для подсветки результатов поиска
// ============================================================

export const searchPluginKey = new PluginKey('search')

interface SearchState {
  query: string
  matches: { from: number; to: number }[]
  currentIndex: number
}

const emptyState: SearchState = { query: '', matches: [], currentIndex: -1 }

export const searchPlugin = new Plugin<SearchState>({
  key: searchPluginKey,

  state: {
    init() {
      return emptyState
    },
    apply(tr, prev) {
      const meta = tr.getMeta(searchPluginKey)
      if (meta) return meta as SearchState
      // Если документ изменился — пересчитываем совпадения для текущего запроса
      if (tr.docChanged && prev.query) {
        const matches = findMatches(tr.doc, prev.query)
        const currentIndex = matches.length > 0
          ? Math.min(prev.currentIndex, matches.length - 1)
          : -1
        return { ...prev, matches, currentIndex }
      }
      return prev
    },
  },

  props: {
    decorations(state) {
      const { query, matches, currentIndex } = searchPluginKey.getState(state)!
      if (!query || matches.length === 0) return DecorationSet.empty

      const decos = matches.map((m: { from: number; to: number }, i: number) =>
        Decoration.inline(m.from, m.to, {
          class: i === currentIndex ? 'search-match-current' : 'search-match',
        })
      )
      return DecorationSet.create(state.doc, decos)
    },
  },
})

function findMatches(doc: import('prosemirror-model').Node, query: string): { from: number; to: number }[] {
  if (!query) return []
  const results: { from: number; to: number }[] = []
  const lowerQuery = query.toLowerCase()

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const text = node.text.toLowerCase()
      let idx = 0
      while (true) {
        idx = text.indexOf(lowerQuery, idx)
        if (idx === -1) break
        results.push({ from: pos + idx, to: pos + idx + query.length })
        idx += 1
      }
    }
  })
  return results
}

// ============================================================
// React компонент SearchBar
// ============================================================

interface SearchBarProps {
  view: EditorView
  onClose: () => void
}

export function SearchBar({ view, onClose }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const searchState = searchPluginKey.getState(view.state) || emptyState

  // Фокус при открытии; если есть выделение — использовать как начальный запрос
  useEffect(() => {
    const { from, to } = view.state.selection
    if (from !== to) {
      const selectedText = view.state.doc.textBetween(from, to)
      if (selectedText.length <= 200) {
        setQuery(selectedText)
        updateSearch(selectedText, 0)
      }
    }
    requestAnimationFrame(() => inputRef.current?.focus())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateSearch = useCallback((q: string, currentIndex: number) => {
    const matches = findMatches(view.state.doc, q)
    const idx = matches.length > 0 ? Math.min(currentIndex, matches.length - 1) : -1
    view.dispatch(view.state.tr.setMeta(searchPluginKey, { query: q, matches, currentIndex: idx }))
    if (idx >= 0 && matches[idx]) scrollToMatch(view, matches[idx])
  }, [view])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    updateSearch(q, 0)
  }, [updateSearch])

  const goNext = useCallback(() => {
    const { matches, currentIndex } = searchPluginKey.getState(view.state) || emptyState
    if (matches.length === 0) return
    const next = (currentIndex + 1) % matches.length
    view.dispatch(view.state.tr.setMeta(searchPluginKey, { query, matches, currentIndex: next }))
    scrollToMatch(view, matches[next])
  }, [view, query])

  const goPrev = useCallback(() => {
    const { matches, currentIndex } = searchPluginKey.getState(view.state) || emptyState
    if (matches.length === 0) return
    const prev = (currentIndex - 1 + matches.length) % matches.length
    view.dispatch(view.state.tr.setMeta(searchPluginKey, { query, matches, currentIndex: prev }))
    scrollToMatch(view, matches[prev])
  }, [view, query])

  const handleClose = useCallback(() => {
    // Очистить подсветку
    view.dispatch(view.state.tr.setMeta(searchPluginKey, emptyState))
    view.focus()
    onClose()
  }, [view, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      handleClose()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) goPrev()
      else goNext()
    }
  }, [handleClose, goNext, goPrev])

  const matchCount = searchState.matches.length
  const currentIdx = searchState.currentIndex

  return (
    <div
      className="search-bar"
      onKeyDown={handleKeyDown}
    >
      <input
        ref={inputRef}
        type="text"
        className="search-input"
        placeholder="Поиск..."
        value={query}
        onChange={handleChange}
        spellCheck={false}
      />

      {/* Счётчик совпадений */}
      <span className="search-count">
        {query ? (matchCount > 0 ? `${currentIdx + 1} / ${matchCount}` : 'Нет совпадений') : ''}
      </span>

      {/* Навигация */}
      <button className="search-nav-btn" onClick={goPrev} disabled={matchCount === 0} title="Предыдущее (Shift+Enter)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
      <button className="search-nav-btn" onClick={goNext} disabled={matchCount === 0} title="Следующее (Enter)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Кнопка закрытия */}
      <button className="search-nav-btn" onClick={handleClose} title="Закрыть (Esc)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

function scrollToMatch(view: EditorView, match: { from: number; to: number }) {
  try {
    const domNode = view.domAtPos(match.from)
    if (domNode.node) {
      const el = domNode.node instanceof Element ? domNode.node : domNode.node.parentElement
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  } catch { /* ignore */ }
}
