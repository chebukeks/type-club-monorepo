/**
 * SearchBar.tsx — Поиск по документу (Ctrl+F).
 * Плавающая панель поверх редактора с подсветкой совпадений.
 *
 * Поддерживает два режима:
 * - ProseMirror (Seamless/Preview) — подсветка через декорации
 * - Raw textarea — подсветка в отдельном слое
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
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

/**
 * Поиск текста в ProseMirror-документе с учётом того, что запрос может
 * пересекать границы inline-марок (bold, italic, code и т.д.).
 * Собираем текст поблочно (paragraph, heading, cell…), ищем в
 * конкатенированной строке и маппим позиции обратно на doc-позиции.
 */
function findMatches(doc: import('prosemirror-model').Node, query: string): { from: number; to: number }[] {
  if (!query) return []
  const results: { from: number; to: number }[] = []
  const lowerQuery = query.toLowerCase()

  doc.descendants((node, pos) => {
    // Ищем только в textblock-нодах (paragraph, heading, code_block, table cells…)
    if (!node.isTextblock) return true

    // Собираем полный текст блока и карту позиций
    const textParts: { text: string; docPos: number }[] = []
    node.forEach((child, offset) => {
      if (child.isText && child.text) {
        textParts.push({ text: child.text, docPos: pos + 1 + offset })
      }
    })

    if (textParts.length === 0) return false // не спускаемся глубже

    // Конкатенируем текст блока
    const fullText = textParts.map(p => p.text).join('')
    const lowerText = fullText.toLowerCase()

    // Строим карту: индекс в fullText → doc-позиция
    const posMap: number[] = new Array(fullText.length)
    let charIdx = 0
    for (const part of textParts) {
      for (let i = 0; i < part.text.length; i++) {
        posMap[charIdx++] = part.docPos + i
      }
    }

    // Ищем все вхождения
    let idx = 0
    while (true) {
      idx = lowerText.indexOf(lowerQuery, idx)
      if (idx === -1) break
      const from = posMap[idx]
      const to = posMap[idx + query.length - 1] + 1
      results.push({ from, to })
      idx += 1
    }

    return false // не спускаемся внутрь textblock'а
  })
  return results
}

// ============================================================
// Debounce утилита
// ============================================================

function useDebounce(fn: () => void, delay: number): [() => void, () => void] {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debounced = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { fn(); timerRef.current = null }, delay)
  }, [fn, delay])

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    fn()
  }, [fn])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return [debounced, flush]
}

// ============================================================
// React компонент SearchBar — ProseMirror режим
// ============================================================

interface SearchBarProps {
  view: EditorView
  onClose: () => void
}

export function SearchBar({ view, onClose }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [matchCount, setMatchCount] = useState(0)
  const [currentIdx, setCurrentIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  const updateSearch = useCallback((q: string, currentIndex: number) => {
    const matches = findMatches(view.state.doc, q)
    const idx = matches.length > 0 ? Math.min(currentIndex, matches.length - 1) : -1
    view.dispatch(view.state.tr.setMeta(searchPluginKey, { query: q, matches, currentIndex: idx }))
    setMatchCount(matches.length)
    setCurrentIdx(idx)
    if (idx >= 0 && matches[idx]) scrollToMatch(view, matches[idx])
  }, [view])

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

  // Debounce: обновляем подсветку с задержкой 300ms
  const pendingQueryRef = useRef(query)
  const doSearch = useCallback(() => {
    updateSearch(pendingQueryRef.current, 0)
  }, [updateSearch])
  const [debouncedSearch, flushSearch] = useDebounce(doSearch, 300)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    pendingQueryRef.current = q
    if (!q) {
      // Пустой запрос — сразу очистить
      view.dispatch(view.state.tr.setMeta(searchPluginKey, emptyState))
      setMatchCount(0)
      setCurrentIdx(-1)
    } else {
      debouncedSearch()
    }
  }, [view, debouncedSearch])

  const goNext = useCallback(() => {
    const st = searchPluginKey.getState(view.state) || emptyState
    if (st.matches.length === 0) return
    const next = (st.currentIndex + 1) % st.matches.length
    view.dispatch(view.state.tr.setMeta(searchPluginKey, { query, matches: st.matches, currentIndex: next }))
    setCurrentIdx(next)
    scrollToMatch(view, st.matches[next])
  }, [view, query])

  const goPrev = useCallback(() => {
    const st = searchPluginKey.getState(view.state) || emptyState
    if (st.matches.length === 0) return
    const prev = (st.currentIndex - 1 + st.matches.length) % st.matches.length
    view.dispatch(view.state.tr.setMeta(searchPluginKey, { query, matches: st.matches, currentIndex: prev }))
    setCurrentIdx(prev)
    scrollToMatch(view, st.matches[prev])
  }, [view, query])

  const handleClose = useCallback(() => {
    view.dispatch(view.state.tr.setMeta(searchPluginKey, emptyState))
    setMatchCount(0)
    setCurrentIdx(-1)
    view.focus()
    onClose()
  }, [view, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      handleClose()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      // Flush debounce и сразу выполнить поиск / перейти к следующему
      flushSearch()
      if (e.shiftKey) goPrev()
      else {
        // Если поиск ещё не запущен — запустить, иначе — следующий
        const st = searchPluginKey.getState(view.state) || emptyState
        if (st.matches.length > 0) goNext()
      }
    }
  }, [handleClose, goNext, goPrev, flushSearch, view])

  return (
    <SearchBarUI
      inputRef={inputRef}
      query={query}
      matchCount={matchCount}
      currentIdx={currentIdx}
      onClose={handleClose}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPrev={goPrev}
      onNext={goNext}
    />
  )
}

// ============================================================
// Поиск по исходному Markdown
// ============================================================

interface RawSearchBarProps {
  textarea: HTMLTextAreaElement
  content: string
  onClose: () => void
  onMatchChange: (match: { from: number; to: number } | null) => void
}

export function RawSearchBar({ textarea, content, onClose, onMatchChange }: RawSearchBarProps) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const matches = useMemo(() => {
    if (!query) return []
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return [...content.matchAll(new RegExp(escaped, 'giu'))].map(({ index, 0: text }) => ({
      from: index!,
      to: index! + text.length,
    }))
  }, [content, query])
  const currentIndex = matches.length ? Math.min(index, matches.length - 1) : -1

  useEffect(() => {
    inputRef.current?.focus()
    return () => onMatchChange(null)
  }, [onMatchChange])

  useEffect(() => {
    onMatchChange(matches[currentIndex] ?? null)
  }, [matches, currentIndex, onMatchChange])

  const move = (direction: number) => {
    if (!matches.length) return
    setIndex((currentIndex + direction + matches.length) % matches.length)
    inputRef.current?.focus()
  }

  const close = () => {
    const match = matches[currentIndex]
    if (match) textarea.setSelectionRange(match.from, match.to)
    textarea.focus()
    onClose()
  }

  return (
    <SearchBarUI
      inputRef={inputRef}
      query={query}
      matchCount={matches.length}
      currentIdx={currentIndex}
      onClose={close}
      onChange={(event) => {
        setQuery(event.target.value)
        setIndex(0)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' || (event.key === 'Enter' && event.target === inputRef.current)) {
          event.preventDefault()
          if (event.key === 'Escape') close()
          else move(event.shiftKey ? -1 : 1)
        }
      }}
      onPrev={() => move(-1)}
      onNext={() => move(1)}
    />
  )
}

// ============================================================
// Общая UI-оболочка для обоих режимов
// ============================================================

import { useEditor } from '../context/EditorContext'

interface SearchBarUIProps {
  inputRef: React.RefObject<HTMLInputElement>
  query: string
  matchCount: number
  currentIdx: number
  onClose: () => void
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onPrev: () => void
  onNext: () => void
}

function SearchBarUI({ inputRef, query, matchCount, currentIdx, onClose, onChange, onKeyDown, onPrev, onNext }: SearchBarUIProps) {
  const { t } = useEditor()
  return (
    <div className="search-bar" onKeyDown={onKeyDown}>
      <input
        ref={inputRef}
        type="text"
        className="search-input"
        placeholder={t('search.placeholder')}
        value={query}
        onChange={onChange}
        spellCheck={false}
      />

      {/* Счётчик совпадений */}
      <span className="search-count">
        {query ? (matchCount > 0 ? `${currentIdx + 1} / ${matchCount}` : t('search.noMatches')) : ''}
      </span>

      {/* Навигация */}
      <button className="search-nav-btn" onClick={onPrev} disabled={matchCount === 0} title={t('search.previous')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
      <button className="search-nav-btn" onClick={onNext} disabled={matchCount === 0} title={t('search.next')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Кнопка закрытия */}
      <button className="search-nav-btn" onClick={onClose} title={t('search.close')}>
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
