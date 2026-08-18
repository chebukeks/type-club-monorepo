/**
 * MarkdownEditor.tsx — Desktop wrapper around @type-club/editor EditorCore.
 * Adds desktop-specific features: zoom, data URI placeholders, search bar,
 * typewriter mode, focus mask, context menu.
 */
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { toggleMark } from 'prosemirror-commands'
import { Plugin, TextSelection, NodeSelection, Selection } from 'prosemirror-state'
import { deleteTable } from 'prosemirror-tables'
import type { EditorView } from 'prosemirror-view'
import { EditorCore, injectEditorStyles, schema, tableEditPluginKey, spellcheckService } from '@type-club/editor'
import { useEditor } from '../context/EditorContext'
import { useAuth } from '../context/AuthContext'
import { useCollaboration } from '../hooks/useCollaboration'
import { ChevronRight } from 'lucide-react'
import { articlesApi, collaborationApi } from '../api'
import { SearchBar, RawSearchBar, searchPlugin } from './SearchBar'
import { AddNoteModal } from './AddNoteModal'
import TableOfContents from './TableOfContents'
import { StatsToast } from './StatsToast'
import type { SuggestionItem } from '@type-club/editor'

import { Monitor, Type, FileText } from 'lucide-react'

export function MarkdownEditor() {
  const { state, dispatch, setTextZoom, setDocumentZoom, t } = useEditor()
  const [editorView, setEditorView] = useState<EditorView | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const lastWheelTimeRef = useRef(0)

  // Инициализация провайдера спеллчекера и синхронизация словарей при старте
  useEffect(() => {
    if (window.api?.isWordMisspelled) {
      spellcheckService.setProvider({
        isWordMisspelled: (word) => window.api.isWordMisspelled(word),
        getWordSuggestions: (word) => window.api.getWordSuggestions(word),
        checkWords: (words) => window.api.checkWords(words),
      })
    }

    if (window.api?.getCustomDictionaryWords) {
      Promise.all([
        window.api.getCustomDictionaryWords(),
        window.api.getSpellcheckLanguages(),
        window.api.getSpellcheck(),
      ])
        .then(([words, langs, enabled]) => {
          spellcheckService.init(words, langs, enabled)
        })
        .catch(() => {})
    }
  }, [])

  const [zoomToast, setZoomToast] = useState<{ type: 'app' | 'text' | 'document'; percent: number } | null>(null)
  const zoomToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showZoomToast = useCallback((type: 'app' | 'text' | 'document', percent: number) => {
    setZoomToast({ type, percent })
    if (zoomToastTimerRef.current) clearTimeout(zoomToastTimerRef.current)
    zoomToastTimerRef.current = setTimeout(() => {
      setZoomToast(null)
    }, 1500)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Raw mode: data URI placeholders
  const [rawContent, setRawContent] = useState<string | null>(null)
  const rawImageMapRef = useRef<Map<string, string>>(new Map())
  const rawSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rawTabIdRef = useRef<string | null>(null)

  const flushRawContentRef = useRef<(() => void) | null>(null)
  flushRawContentRef.current = () => {
    if (rawSyncTimerRef.current) { clearTimeout(rawSyncTimerRef.current); rawSyncTimerRef.current = null }
    if (rawContent === null || !rawTabIdRef.current) return
    let restored = rawContent
    for (const [placeholder, original] of rawImageMapRef.current) {
      restored = restored.split(placeholder).join(original)
    }
    dispatch({ type: 'UPDATE_CONTENT', payload: { tabId: rawTabIdRef.current, content: restored } })
  }

  const prevTabIdRef = useRef(state.activeTabId)
  const prevEditorModeRef = useRef(state.editorMode)
  useEffect(() => {
    const tabChanged = prevTabIdRef.current !== state.activeTabId
    const modeChanged = prevEditorModeRef.current !== state.editorMode
    prevTabIdRef.current = state.activeTabId
    prevEditorModeRef.current = state.editorMode

    if (tabChanged || modeChanged) {
      flushRawContentRef.current?.()
      setRawContent(null)
      rawImageMapRef.current = new Map()
      rawTabIdRef.current = null
    }
  }, [state.activeTabId, state.editorMode])

  const { user } = useAuth()
  const activeTab = state.tabs.find((t) => t.id === state.activeTabId)
  const content = activeTab?.content || ''
  const articleId = activeTab?.articleId ?? null

  const [rolesMap, setRolesMap] = useState<Record<number, 'author' | 'co_author' | 'editor' | null>>({})
  const userRole = articleId ? (rolesMap[articleId] ?? null) : null
  const [showAddNoteModal, setShowAddNoteModal] = useState(false)

  useEffect(() => {
    if (!articleId || !user || rolesMap[articleId] !== undefined) {
      return
    }
    let isCurrent = true
    articlesApi.get(articleId).then((art) => {
      if (!isCurrent) return
      if (art.author_id === user.id) {
        setRolesMap((prev) => ({ ...prev, [articleId]: 'author' }))
      } else {
        collaborationApi.list(articleId)
          .then((list) => {
            if (!isCurrent) return
            const me = list.find((c) => c.user_id === user.id)
            const role = (me?.role as any) ?? null
            setRolesMap((prev) => ({ ...prev, [articleId]: role }))
          })
          .catch(() => { if (isCurrent) setRolesMap((prev) => ({ ...prev, [articleId]: null })) })
      }
    }).catch(() => { if (isCurrent) setRolesMap((prev) => ({ ...prev, [articleId]: null })) })

    return () => {
      isCurrent = false
    }
  }, [articleId, user, rolesMap])

  useEffect(() => {
    const handler = () => setShowAddNoteModal(true)
    window.addEventListener('editor-open-add-note-modal', handler)
    return () => window.removeEventListener('editor-open-add-note-modal', handler)
  }, [])

  const handleAddNoteSubmit = useCallback((noteText: string) => {
    if (!editorView || !noteText.trim()) return
    const { from } = editorView.state.selection
    const noteNode = editorView.state.schema.nodes.suggestion_note.create({
      noteId: crypto.randomUUID(),
      sugAuthorId: user?.id ?? 0,
      sugAuthorName: user?.nickname || t('editor.advisor'),
      sugColor: '#f59e0b',
      noteText: noteText.trim(),
      sugCreatedAt: new Date().toISOString(),
    })
    const tr = editorView.state.tr.insert(from, noteNode)
    tr.setMeta('suggestionAction', true)
    editorView.dispatch(tr)
    editorView.focus()
  }, [editorView, user, t])

  const collab = useCollaboration(articleId, user, userRole)
  const suggestionModeActive = articleId != null && (activeTab?.suggestionMode ?? false)

  useEffect(() => {
    if (articleId != null && userRole === 'editor' && activeTab && !activeTab.suggestionMode) {
      dispatch({ type: 'SET_SUGGESTION_MODE', payload: { tabId: activeTab.id, active: true } })
    }
  }, [articleId, userRole, activeTab?.id, activeTab?.suggestionMode, dispatch])

  const isReadOnly = state.editorMode === 'preview' || (articleId != null && userRole == null)

  const replaceDataUris = useCallback((md: string): string => {
    const map = new Map<string, string>()
    let idx = 0
    const replaced = md.replace(/data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=\s]+/g, (match) => {
      const placeholder = `__IMG_${idx++}__`
      map.set(placeholder, match.trim())
      return placeholder
    })
    rawImageMapRef.current = map
    return replaced
  }, [])

  useEffect(() => {
    injectEditorStyles()
  }, [])

  // ── Zoom: Ctrl+scroll ──
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const now = Date.now()
        if (now - lastWheelTimeRef.current < 30) return
        lastWheelTimeRef.current = now
        const delta = e.deltaY < 0 ? 10 : -10
        if (e.altKey) {
          const next = Math.max(50, Math.min(300, state.documentZoom + delta))
          setDocumentZoom(next)
          showZoomToast('document', next)
        } else if (e.shiftKey) {
          const next = Math.max(50, Math.min(200, state.textZoom + delta))
          setTextZoom(next)
          showZoomToast('text', next)
        } else {
          const next = Math.max(50, Math.min(300, state.documentZoom + delta))
          setDocumentZoom(next)
          showZoomToast('document', next)
        }
      }
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [state.documentZoom, state.textZoom, setDocumentZoom, setTextZoom, showZoomToast])

  // ── Zoom: keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isPlus = e.code === 'Equal' || e.code === 'NumpadAdd'
      const isMinus = e.code === 'Minus' || e.code === 'NumpadSubtract'
      const isZero = e.code === 'Digit0' || e.code === 'Numpad0'

      if (e.ctrlKey || e.metaKey) {
        if (e.code === 'KeyF' && !e.shiftKey && !e.altKey) {
          e.preventDefault()
          setShowSearch(s => !s)
          return
        }
        if (!isPlus && !isMinus && !isZero) return

        if (e.altKey && !e.shiftKey) {
          e.preventDefault()
          const next = isZero ? 100 : Math.max(50, Math.min(300, state.documentZoom + (isPlus ? 10 : -10)))
          setDocumentZoom(next)
          showZoomToast('document', next)
        } else if (e.shiftKey && !e.altKey) {
          e.preventDefault()
          const next = isZero ? 100 : Math.max(50, Math.min(200, state.textZoom + (isPlus ? 10 : -10)))
          setTextZoom(next)
          showZoomToast('text', next)
        } else if (!e.shiftKey && !e.altKey) {
          e.preventDefault()
          const pct = isZero ? window.api?.zoomReset?.() : isPlus ? window.api?.zoomIn?.() : window.api?.zoomOut?.()
          if (pct != null) showZoomToast('app', pct)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.textZoom, state.documentZoom, setTextZoom, setDocumentZoom, showZoomToast])

  const activeTabId = activeTab?.id
  // ── Content handlers ──
  const handleChange = useCallback((md: string) => {
    if (!activeTabId) return
    dispatch({ type: 'UPDATE_CONTENT', payload: { tabId: activeTabId, content: md } })
  }, [activeTabId, dispatch])

  useEffect(() => {
    if (state.editorMode === 'raw' && activeTabId) {
      if (rawTabIdRef.current !== activeTabId || rawContent === null) {
        rawTabIdRef.current = activeTabId
        const replaced = replaceDataUris(content)
        setRawContent(replaced)
      }
    }
  }, [state.editorMode, activeTabId, content, replaceDataUris, rawContent])

  const handleRawChange = useCallback((text: string) => {
    setRawContent(text)
    rawTabIdRef.current = activeTabId ?? null
    if (rawSyncTimerRef.current) clearTimeout(rawSyncTimerRef.current)
    rawSyncTimerRef.current = setTimeout(() => {
      flushRawContentRef.current?.()
    }, 1500)
  }, [activeTabId])

  // ── Typewriter plugin ──
  const isTypewriterModeRef = useRef(state.typewriterMode)
  useEffect(() => {
    isTypewriterModeRef.current = state.typewriterMode
    if (state.typewriterMode && editorView && !editorView.isDestroyed) {
      requestAnimationFrame(() => {
        if (editorView.isDestroyed) return
        const { head } = editorView.state.selection
        const scrollContainer = editorView.dom.closest('.overflow-auto') as HTMLElement
        if (!scrollContainer) return
        try {
          const coords = editorView.coordsAtPos(head)
          const containerRect = scrollContainer.getBoundingClientRect()
          const caretCenterY = (coords.top + coords.bottom) / 2
          const containerCenterY = containerRect.top + containerRect.height / 2
          const offset = caretCenterY - containerCenterY
          if (Math.abs(offset) > 1) scrollContainer.scrollBy({ top: offset })
        } catch {
          const pt = parseFloat(getComputedStyle(editorView.dom).paddingTop) || 0
          scrollContainer.scrollTop = Math.max(0, pt - scrollContainer.clientHeight / 2)
        }
      })
    }
  }, [state.typewriterMode, editorView])

  const isMouseSelectingRef = useRef(false)
  const caretDocY = useRef(-1)

  function updateFocusMaskFromDocY(scrollContainer: HTMLElement) {
    if (caretDocY.current < 0) return
    scrollContainer.style.setProperty('--focus-mask-y', `${caretDocY.current - scrollContainer.scrollTop}px`)
  }

  function updateCaretDocY(view: EditorView) {
    const scrollContainer = view.dom.closest('.overflow-auto') as HTMLElement
    if (!scrollContainer) return

    let caretCenterY: number
    const activeEl = document.activeElement as HTMLElement
    if (activeEl && activeEl !== view.dom && scrollContainer.contains(activeEl)) {
      const rect = activeEl.getBoundingClientRect()
      caretCenterY = (rect.top + rect.bottom) / 2
    } else {
      try {
        const coords = view.coordsAtPos(view.state.selection.head)
        caretCenterY = (coords.top + coords.bottom) / 2
      } catch { return }
    }

    const containerRect = scrollContainer.getBoundingClientRect()
    caretDocY.current = (caretCenterY - containerRect.top) + scrollContainer.scrollTop
    updateFocusMaskFromDocY(scrollContainer)
    return { scrollContainer, caretCenterY, containerRect }
  }

  function typewriterScrollToHead(view: EditorView) {
    const result = updateCaretDocY(view)
    if (!result) return
    const { scrollContainer, caretCenterY, containerRect } = result
    const containerCenterY = containerRect.top + containerRect.height / 2
    const offset = caretCenterY - containerCenterY
    if (Math.abs(offset) > 1) {
      scrollContainer.scrollBy({ top: offset, behavior: 'smooth' })
    }
  }

  const typewriterPlugin = useMemo(() => new Plugin({
    props: {
      handleScrollToSelection() {
        return isTypewriterModeRef.current
      },
      handleDOMEvents: {
        mousedown: () => { isMouseSelectingRef.current = true; return false },
        mouseup: (view) => {
          isMouseSelectingRef.current = false
          requestAnimationFrame(() => {
            if (isTypewriterModeRef.current) typewriterScrollToHead(view)
            else updateCaretDocY(view)
          })
          return false
        },
      },
    },
    view() {
      let scrollHandler: (() => void) | null = null
      let scrollContainer: HTMLElement | null = null

      return {
        update(view, prevState) {
          if (!scrollHandler) {
            scrollContainer = view.dom.closest('.overflow-auto') as HTMLElement
            if (scrollContainer) {
              scrollHandler = () => updateFocusMaskFromDocY(scrollContainer!)
              scrollContainer.addEventListener('scroll', scrollHandler, { passive: true })
            }
          }

          const needsUpdate = !view.state.selection.eq(prevState.selection) || !view.state.doc.eq(prevState.doc) || view.state !== prevState
          if (needsUpdate && !isMouseSelectingRef.current) {
            if (isTypewriterModeRef.current) typewriterScrollToHead(view)
            else updateCaretDocY(view)
          }
        },
        destroy() {
          if (scrollHandler && scrollContainer) {
            scrollContainer.removeEventListener('scroll', scrollHandler)
          }
        },
      }
    },
  }), [])

  // ── Focus mask-image style ──
  const containerStyle = useMemo((): React.CSSProperties => {
    if (state.focusMode !== 'lines') return {}
    return {
      maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.3) calc(var(--focus-mask-y, 50%) - calc(50px * var(--doc-scale, 1))), black calc(var(--focus-mask-y, 50%) - calc(30px * var(--doc-scale, 1))), black calc(var(--focus-mask-y, 50%) + calc(30px * var(--doc-scale, 1))), rgba(0,0,0,0.3) calc(var(--focus-mask-y, 50%) + calc(50px * var(--doc-scale, 1))))',
      WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.3) calc(var(--focus-mask-y, 50%) - calc(50px * var(--doc-scale, 1))), black calc(var(--focus-mask-y, 50%) - calc(30px * var(--doc-scale, 1))), black calc(var(--focus-mask-y, 50%) + calc(30px * var(--doc-scale, 1))), rgba(0,0,0,0.3) calc(var(--focus-mask-y, 50%) + calc(50px * var(--doc-scale, 1))))',
    }
  }, [state.focusMode])

  // ── TOC ──
  const handleTocUpdate = useCallback((toc: any[]) => {
    dispatch({ type: 'SET_ACTIVE_TOC', payload: toc })
  }, [dispatch])

  // ── Search open event ──
  useEffect(() => {
    const handler = () => setShowSearch(true)
    window.addEventListener('editor-open-search', handler)
    return () => window.removeEventListener('editor-open-search', handler)
  }, [])

  // ── TOC scroll-to event ──
  useEffect(() => {
    const handler = (e: Event) => {
      const { pos } = (e as CustomEvent<{ pos: number }>).detail
      if (!editorView || editorView.isDestroyed) return
      try {
        let domNode: Node | null = null
        try { domNode = editorView.nodeDOM(pos) } catch {}
        if (!domNode) {
          try { domNode = editorView.domAtPos(pos).node } catch {}
        }
        const el = domNode instanceof Element ? domNode : domNode?.parentElement
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      } catch { /* ignore */ }
    }
    window.addEventListener('editor-scroll-to', handler)
    return () => window.removeEventListener('editor-scroll-to', handler)
  }, [editorView])

  // ── TOC scroll-to-suggestion event ──
  useEffect(() => {
    const handler = (e: Event) => {
      const { pos, toPos } = (e as CustomEvent<{ pos: number; toPos?: number }>).detail
      if (!editorView || editorView.isDestroyed) return

      try {
        const docSize = editorView.state.doc.content.size
        const targetPos = Math.min(Math.max(1, pos), docSize)
        let selection
        if (toPos && toPos > targetPos && toPos <= docSize) {
          selection = TextSelection.create(editorView.state.doc, targetPos, toPos)
        } else {
          selection = Selection.near(editorView.state.doc.resolve(targetPos))
        }

        const tr = editorView.state.tr.setSelection(selection)
        editorView.dispatch(tr)
        editorView.focus()
      } catch { /* ignore selection errors */ }

      try {
        let domNode: Node | null = null
        try { domNode = editorView.nodeDOM(pos) } catch {}
        if (!domNode) {
          try { domNode = editorView.domAtPos(pos).node } catch {}
        }

        const el = domNode instanceof Element ? domNode : domNode?.parentElement
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      } catch { /* ignore scroll errors */ }
    }
    window.addEventListener('editor-scroll-to-suggestion', handler)
    return () => window.removeEventListener('editor-scroll-to-suggestion', handler)
  }, [editorView])

  // ── Context menu ──
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [ctxSubmenu, setCtxSubmenu] = useState<'table' | 'code' | null>(null)
  const [ctxTable, setCtxTable] = useState<number | null>(null)
  const [tableCols, setTableCols] = useState(3)
  const [tableRows, setTableRows] = useState(3)
  const [codeLang, setCodeLang] = useState('')
  const [showLangDropdown, setShowLangDropdown] = useState(false)
  const langDropdownRef = useRef<HTMLDivElement>(null)

  const CODE_LANGUAGES = [
    'javascript', 'typescript', 'python', 'bash', 'html', 'css', 'json', 'sql',
    'rust', 'go', 'java', 'cpp', 'c', 'ruby', 'php', 'yaml', 'xml', 'diff',
    'markdown', 'dockerfile', 'graphql'
  ]

  // Извлечение слова и диапазона по координатам курсора или текущей позиции
  const getWordAtDocPos = (
    view: EditorView,
    clientX: number,
    clientY: number
  ): { word: string; from: number; to: number } | null => {
    try {
      let pos: number | null = null
      try {
        const posInfo = view.posAtCoords({ left: clientX, top: clientY })
        if (posInfo) pos = posInfo.pos
      } catch { /* ignore */ }

      if (pos == null) {
        pos = view.state.selection.from
      }

      const $pos = view.state.doc.resolve(pos)
      const textblock = $pos.parent
      if (!textblock || !textblock.isTextblock) return null

      const text = textblock.textContent
      const offset = $pos.parentOffset
      if (!text) return null

      const isWordChar = (c: string) => /[\p{L}\p{N}_'-]/u.test(c)

      let start = Math.min(Math.max(0, offset), text.length)
      if (start > 0 && !isWordChar(text[start]) && isWordChar(text[start - 1])) {
        start--
      }
      if (start >= text.length || !isWordChar(text[start])) {
        return null
      }

      while (start > 0 && isWordChar(text[start - 1])) {
        start--
      }
      let end = start
      while (end < text.length && isWordChar(text[end])) {
        end++
      }

      const rawWord = text.slice(start, end).trim()
      const cleanWord = rawWord.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/u, '')
      if (!cleanWord || cleanWord.length < 1) return null

      const wordFrom = $pos.start() + start
      const wordTo = $pos.start() + end

      return {
        word: cleanWord,
        from: wordFrom,
        to: wordTo,
      }
    } catch {
      return null
    }
  }

  const [ctxMenuMounted, setCtxMenuMounted] = useState(false)
  const [ctxSpellcheck, setCtxSpellcheck] = useState<{
    misspelledWord: string
    dictionarySuggestions: string[]
    range: { from: number; to: number } | null
  } | null>(null)

  const handleContextMenu = async (e: React.MouseEvent) => {
    if (state.editorMode !== 'seamless') return
    e.preventDefault()
    setCtxTable(null)
    setCtxSubmenu(null)
    setTableCols(3)
    setTableRows(3)
    setCodeLang('')

    let spellcheckInfo: {
      misspelledWord: string
      dictionarySuggestions: string[]
      range: { from: number; to: number } | null
    } | null = null

    if (editorView) {
      // 1. Проверяем, был ли клик по таблице
      try {
        const clickPos = editorView.posAtDOM(e.target as Node, 0)
        const $click = editorView.state.doc.resolve(clickPos)
        for (let d = $click.depth; d > 0; d--) {
          if ($click.node(d).type.name === 'table') {
            setCtxTable($click.before(d))
            setCtxSpellcheck(null)
            setCtxMenu({ x: e.clientX, y: e.clientY })
            return
          }
        }
      } catch { /* ignore */ }

      // 2. Проверяем слово под курсором или выделение для спеллчекера
      try {
        const { from, to } = editorView.state.selection
        let targetWord: string | null = null
        let targetRange: { from: number; to: number } | null = null

        if (from !== to) {
          const selText = editorView.state.doc.textBetween(from, to).trim()
          if (selText && !selText.includes(' ') && !selText.includes('\n')) {
            const clean = selText.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/u, '')
            if (clean) {
              targetWord = clean
              targetRange = { from, to }
            }
          }
        }

        if (!targetWord) {
          const wordAtPos = getWordAtDocPos(editorView, e.clientX, e.clientY)
          if (wordAtPos) {
            targetWord = wordAtPos.word
            targetRange = { from: wordAtPos.from, to: wordAtPos.to }
            try {
              const clickPos = editorView.posAtCoords({ left: e.clientX, top: e.clientY })
              if (clickPos && (clickPos.pos < from || clickPos.pos > to)) {
                editorView.dispatch(editorView.state.tr.setSelection(Selection.near(editorView.state.doc.resolve(clickPos.pos))))
              }
            } catch { /* ignore */ }
          }
        }

        if (targetWord) {
          const isMisspelled = await spellcheckService.isWordMisspelled(targetWord)
          if (isMisspelled) {
            const suggestions = await spellcheckService.getWordSuggestions(targetWord)
            spellcheckInfo = {
              misspelledWord: targetWord,
              dictionarySuggestions: suggestions,
              range: targetRange,
            }
          }
        }
      } catch (err) {
        console.error('Error resolving spellcheck on contextmenu:', err)
      }
    }

    setCtxSpellcheck(spellcheckInfo)
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }


  useEffect(() => {
    if (ctxMenu) {
      setCtxMenuMounted(true)
    } else {
      const timer = setTimeout(() => {
        setCtxMenuMounted(false)
        setCtxSpellcheck(null)
        setCtxSubmenu(null)
        setCtxTable(null)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [ctxMenu])

  const ctxMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!ctxMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (e.button === 0) {
        if (ctxMenuRef.current && ctxMenuRef.current.contains(e.target as Node)) {
          return
        }
        setCtxMenu(null)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [ctxMenu])

  const closeCtxMenu = () => {
    setCtxMenu(null)
  }

  const handleApplySuggestion = (suggestion: string) => {
    if (!editorView || !ctxSpellcheck?.misspelledWord) return
    const { state: pmState, dispatch } = editorView
    let tr = pmState.tr
    if (ctxSpellcheck.range) {
      tr = tr.insertText(suggestion, ctxSpellcheck.range.from, ctxSpellcheck.range.to)
    } else {
      const { from, to } = pmState.selection
      tr = tr.insertText(suggestion, from, to)
    }
    dispatch(tr.setMeta('spellcheckRefresh', true))
    editorView.focus()
    closeCtxMenu()
  }

  const handleAddToDictionary = async () => {
    if (!ctxSpellcheck?.misspelledWord) return
    const word = ctxSpellcheck.misspelledWord
    spellcheckService.addCustomWord(word)
    await window.api?.addCustomWord(word)
    if (editorView) {
      editorView.dispatch(editorView.state.tr.setMeta('spellcheckRefresh', true))
      editorView.focus()
    }
    closeCtxMenu()
  }

  const handleTableCopy = () => {
    if (!editorView || ctxTable == null) return
    const tr = editorView.state.tr.setSelection(NodeSelection.create(editorView.state.doc, ctxTable))
    editorView.dispatch(tr)
    editorView.dom.focus()
    document.execCommand('copy')
    closeCtxMenu()
  }

  const handleTableCut = () => {
    if (!editorView || ctxTable == null) return
    const tr = editorView.state.tr.setSelection(NodeSelection.create(editorView.state.doc, ctxTable))
    editorView.dispatch(tr)
    editorView.dom.focus()
    document.execCommand('copy')
    deleteTable(editorView.state, editorView.dispatch)
    editorView.focus()
    closeCtxMenu()
  }

  const handleTableEdit = () => {
    if (!editorView || ctxTable == null) return
    editorView.dispatch(editorView.state.tr.setMeta(tableEditPluginKey, ctxTable))
    editorView.focus()
    closeCtxMenu()
  }

  const handleTableDelete = () => {
    if (!editorView || ctxTable == null) return
    deleteTable(editorView.state, editorView.dispatch)
    editorView.focus()
    closeCtxMenu()
  }

  // Вычисление позиции меню с учётом viewport
  const lastMenuStyleRef = useRef<React.CSSProperties | null>(null)
  const ctxMenuStyle = useMemo((): React.CSSProperties | null => {
    if (!ctxMenu) return lastMenuStyleRef.current
    const menuHeight = ctxSubmenu === 'table' ? 300 : ctxSubmenu === 'code' ? 260 : 400
    const vh = window.innerHeight
    const fitsBelow = ctxMenu.y + menuHeight <= vh - 10
    const st: React.CSSProperties = {
      top: fitsBelow ? ctxMenu.y : undefined,
      bottom: fitsBelow ? undefined : vh - ctxMenu.y,
      left: Math.min(ctxMenu.x, window.innerWidth - 270),
      minWidth: ctxSubmenu === 'table' ? '260px' : ctxSubmenu === 'code' ? '250px' : '230px',
    }
    lastMenuStyleRef.current = st
    return st
  }, [ctxMenu, ctxSubmenu])

  const applyFormat = (markName: string) => {
    if (!editorView) return
    const mark = (schema.marks as Record<string, unknown>)[markName]
    if (mark) {
      toggleMark(mark as import('prosemirror-model').MarkType)(editorView.state, editorView.dispatch)
      editorView.focus()
    }
    closeCtxMenu()
  }

  const handleClipboard = (action: 'copy' | 'cut' | 'paste') => {
    if (!editorView) return
    editorView.dom.focus()
    document.execCommand(action)
    closeCtxMenu()
  }

  const insertBlockNode = (blockNode: import('prosemirror-model').Node) => {
    if (!editorView) return
    const { $head } = editorView.state.selection

    // Ищем родительский блок
    let blockDepth = -1
    for (let d = $head.depth; d >= 0; d--) {
      const name = $head.node(d).type.name
      if (name === 'paragraph' || name === 'heading' || name === 'code_block' || name === 'math_block') {
        blockDepth = d
        break
      }
    }
    if (blockDepth === -1) return

    const blockStart = $head.before(blockDepth)
    const blockEnd = $head.after(blockDepth)
    const blockNodeAt = editorView.state.doc.nodeAt($head.before(blockDepth))

    // Если блок пустой — заменяем его; иначе вставляем после
    const isEmpty = !blockNodeAt || blockNodeAt.textContent.trim() === ''
    let tr: import('prosemirror-state').Transaction

    if (isEmpty) {
      tr = editorView.state.tr.replaceWith(blockStart, blockEnd, blockNode)
      tr.setSelection(TextSelection.near(tr.doc.resolve(blockStart + 1)))
    } else {
      tr = editorView.state.tr.insert(blockEnd, blockNode)
      tr.setSelection(TextSelection.near(tr.doc.resolve(blockEnd + 1)))
    }

    editorView.dispatch(tr)
    editorView.focus()
    closeCtxMenu()
  }

  const insertTable = () => {
    const rowsNode = []
    for (let r = 0; r < tableRows; r++) {
      const cellsNode = []
      for (let c = 0; c < tableCols; c++) {
        const isHeader = r === 0
        const cellType = isHeader ? schema.nodes.table_header : schema.nodes.table_cell
        const text = isHeader ? t('editor.table.header', { col: c + 1 }) : t('editor.table.cell', { col: c + 1 })
        cellsNode.push(cellType.createAndFill({}, schema.nodes.paragraph.create({}, schema.text(text)))!)
      }
      rowsNode.push(schema.nodes.table_row.create({}, cellsNode))
    }
    const table = schema.nodes.table.create({}, rowsNode)
    insertBlockNode(table)
  }

  const insertCodeBlock = (lang = codeLang) => {
    const codeBlock = schema.nodes.code_block.create({ params: lang }, schema.text(' '))
    insertBlockNode(codeBlock)
  }

  const insertMathBlock = () => {
    const mathBlock = schema.nodes.math_block.create()
    insertBlockNode(mathBlock)
  }

  const formatItems = [
    { label: t('editor.format.bold'), hotkey: 'Ctrl+B', command: 'strong' },
    { label: t('editor.format.italic'), hotkey: 'Ctrl+I', command: 'em' },
    { label: t('editor.format.code'), hotkey: 'Ctrl+E', command: 'code' },
    { label: t('editor.format.strikethrough'), hotkey: 'Ctrl+Shift+X', command: 's' },
    { label: t('editor.format.highlight'), hotkey: 'Ctrl+Shift+H', command: 'highlight' },
    { label: t('editor.format.spoiler'), hotkey: 'Ctrl+Shift+S', command: 'spoiler' },
  ]

  const sep = <div className="border-t border-[var(--border-default)] my-1 mx-1.5 opacity-80" />

  const ctxMenuItem = (label: string, hotkey?: React.ReactNode, onClick?: () => void, extraClass?: string) => (
    <div
      className={`menu-item enabled ${extraClass || ''}`}
      onClick={onClick}
    >
      <span>{label}</span>
      {hotkey && (
        typeof hotkey === 'string'
          ? <span className="text-[10px] text-[var(--text-dim)]">{hotkey}</span>
          : hotkey
      )}
    </div>
  )

  const numInput = (label: string, value: number, setValue: (v: number) => void, min = 1, max = 10) => (
    <div style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span className="text-xs text-[var(--text-dim)] w-16">{label}</span>
      <button
        className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-secondary)] hover:bg-[var(--menu-hover-bg)] disabled:opacity-30 text-xs"
        disabled={value <= min}
        onClick={() => setValue(value - 1)}
      >−</button>
      <span className="w-6 text-center text-xs text-[var(--text-secondary)]">{value}</span>
      <button
        className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-secondary)] hover:bg-[var(--menu-hover-bg)] disabled:opacity-30 text-xs"
        disabled={value >= max}
        onClick={() => setValue(value + 1)}
      >+</button>
    </div>
  )

  const tablePreview = useMemo(() => {
    const rows: JSX.Element[] = []
    for (let r = 0; r < tableRows; r++) {
      const cells: JSX.Element[] = []
      for (let c = 0; c < tableCols; c++) {
        cells.push(
          <td key={c} className={`border border-[var(--border-strong)] px-2 py-0.5 text-[11px] ${r === 0 ? 'font-semibold bg-[var(--menu-hover-bg)]' : ''}`}>
            {r === 0 ? t('editor.table.header', { col: c + 1 }) : t('editor.table.cell', { col: c + 1 })}
          </td>
        )
      }
      rows.push(<tr key={r}>{cells}</tr>)
    }
    return rows
  }, [tableCols, tableRows, t])

  const languagesList = useMemo(() => [
    { label: t('editor.noLanguage'), value: '' },
    ...CODE_LANGUAGES.map((lang) => ({
      label: lang.charAt(0).toUpperCase() + lang.slice(1),
      value: lang,
    }))
  ], [t])

  const isSuggestionActive = articleId != null && (userRole === 'editor' || suggestionModeActive) && state.editorMode === 'seamless'

  const handleScroll = useCallback((st: number) => {
    if (!activeTabId) return
    dispatch({ type: 'SAVE_SCROLL_POSITION', payload: { tabId: activeTabId, scrollTop: st } })
  }, [activeTabId, dispatch])

  const docScale = (state.documentZoom || 100) / 100
  const docHalfWidth = 430 * docScale
  const leftPos = containerWidth / 2 + docHalfWidth + 16
  const rightPos = 32
  const availableWidth = containerWidth - rightPos - leftPos

  const showRightSidebar = availableWidth >= 180 && containerWidth >= 900

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-base)] rounded-[inherit] relative"
      onContextMenu={handleContextMenu}
      onClick={() => closeCtxMenu()}
    >
      {state.editorMode !== 'raw' && showSearch && editorView && (
        <SearchBar view={editorView} onClose={() => setShowSearch(false)} />
      )}

      {state.editorMode === 'raw' && showSearch && textareaRef.current && activeTab && (
        <RawSearchBar textarea={textareaRef.current} content={content} onClose={() => setShowSearch(false)} />
      )}

      <EditorCore
        key={state.activeTabId || 'none'}
        content={state.editorMode === 'raw' ? (rawContent ?? content) : content}
        editorMode={state.editorMode}
        onChange={state.editorMode === 'raw' ? handleRawChange : handleChange}
        textZoom={state.textZoom}
        documentZoom={state.documentZoom}
        readOnly={isReadOnly}
        collaboration={articleId != null ? (collab.config ?? undefined) : undefined}
        userRole={articleId != null ? userRole : null}
        userId={user?.id}
        userNickname={user?.nickname || ''}
        suggestionModeActive={isSuggestionActive}
        onEditorView={(v) => setEditorView(v)}
        className={state.typewriterMode ? 'typewriter-mode' : ''}
        focusMode={state.focusMode}
        onTocUpdate={(tocItems, sugItems) => {
          handleTocUpdate(tocItems)
          if (sugItems) setSuggestions(sugItems)
        }}
        extraPlugins={[typewriterPlugin, searchPlugin]}
        containerStyle={containerStyle}
        scrollTop={activeTab?.scrollTop}
        onScroll={handleScroll}
      />

      {showAddNoteModal && (
        <AddNoteModal
          isOpen={showAddNoteModal}
          onClose={() => setShowAddNoteModal(false)}
          onSubmit={handleAddNoteSubmit}
        />
      )}

      {/* Контекстные меню */}
      {ctxMenuMounted && ctxTable !== null && (
        <div
          ref={ctxMenuRef}
          className={`fixed bg-[var(--bg-elevated)] backdrop-blur-xl border border-[var(--border-strong)] rounded-lg shadow-xl z-50 py-0.5 flex flex-col text-[12px] text-[var(--text-secondary)] ${
            ctxMenu ? 'animate-in fade-in zoom-in-95 duration-100 ease-out' : 'animate-out fade-out zoom-out-95 duration-100 ease-in fill-mode-forwards'
          }`}
          style={ctxMenuStyle!}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {ctxMenuItem(t('editor.table.copy'), undefined, handleTableCopy)}
          {!isSuggestionActive && (
            <>
              {ctxMenuItem(t('editor.table.cut'), undefined, handleTableCut)}
              {ctxMenuItem(t('editor.table.edit'), undefined, handleTableEdit)}
              {ctxMenuItem(t('editor.table.delete'), undefined, handleTableDelete)}
            </>
          )}
        </div>
      )}

      {ctxMenuMounted && !ctxSubmenu && ctxTable === null && (
        <div
          ref={ctxMenuRef}
          className={`fixed bg-[var(--bg-elevated)] backdrop-blur-xl border border-[var(--border-strong)] rounded-lg shadow-xl z-50 py-0.5 flex flex-col text-[12px] text-[var(--text-secondary)] ${
            ctxMenu ? 'animate-in fade-in zoom-in-95 duration-100 ease-out' : 'animate-out fade-out zoom-out-95 duration-100 ease-in fill-mode-forwards'
          }`}
          style={ctxMenuStyle!}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Спеллчекер: варианты исправлений и добавление в словарь */}
          {ctxSpellcheck?.misspelledWord && (
            <>
              {ctxSpellcheck.dictionarySuggestions.length > 0 && (
                <>
                  {ctxSpellcheck.dictionarySuggestions.slice(0, 5).map((suggestion) => (
                    <div
                      key={suggestion}
                      className="menu-item enabled font-medium text-[var(--text-primary)] hover:text-[var(--accent)]"
                      onClick={() => handleApplySuggestion(suggestion)}
                    >
                      <span>{suggestion}</span>
                    </div>
                  ))}
                  {sep}
                </>
              )}
              {ctxMenuItem(t('editor.menu.addToDictionary'), undefined, handleAddToDictionary)}
              {sep}
            </>
          )}

          {ctxMenuItem(t('editor.menu.copy'), 'Ctrl+C', () => handleClipboard('copy'))}
          {ctxMenuItem(t('editor.menu.cut'), 'Ctrl+X', () => handleClipboard('cut'))}
          {ctxMenuItem(t('editor.menu.paste'), 'Ctrl+V', () => handleClipboard('paste'))}
          {!isSuggestionActive && (
            <>
              {sep}
              {formatItems.map((item) => (
                <div
                  key={item.command}
                  className="menu-item enabled"
                  onClick={() => applyFormat(item.command)}
                >
                  <span>{item.label}</span>
                  <span className="text-[10px] text-[var(--text-dim)]">{item.hotkey}</span>
                </div>
              ))}
              {sep}
              {ctxMenuItem(t('editor.menu.createTable'), <ChevronRight size={13} className="text-[var(--text-dim)]" />, () => setCtxSubmenu('table'))}
              {ctxMenuItem(t('editor.menu.createCodeBlock'), <ChevronRight size={13} className="text-[var(--text-dim)]" />, () => setCtxSubmenu('code'))}
              {ctxMenuItem(t('editor.menu.createMathBlock'), undefined, insertMathBlock)}
            </>
          )}
          {isSuggestionActive && (
            <>
              {sep}
              {ctxMenuItem(t('editor.menu.createNote'), 'Ctrl+Q', () => {
                closeCtxMenu()
                setShowAddNoteModal(true)
              })}
            </>
          )}
        </div>
      )}

      {ctxMenuMounted && ctxSubmenu === 'table' && (
        <div
          ref={ctxMenuRef}
          className={`fixed bg-[var(--bg-elevated)] backdrop-blur-xl border border-[var(--border-strong)] rounded-lg shadow-xl z-50 py-0.5 flex flex-col text-[12px] text-[var(--text-secondary)] ${
            ctxMenu ? 'animate-in fade-in zoom-in-95 duration-100 ease-out' : 'animate-out fade-out zoom-out-95 duration-100 ease-in fill-mode-forwards'
          }`}
          style={ctxMenuStyle!}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {ctxMenuItem(t('common.back'), undefined, () => setCtxSubmenu(null))}
          {sep}
          {numInput(t('editor.table.columns'), tableCols, setTableCols)}
          {numInput(t('editor.table.rows'), tableRows, setTableRows)}
          {sep}
          <div className="overflow-x-auto" style={{ padding: '6px 14px' }}>
            <table className="w-full border-collapse border border-[var(--border-strong)]">
              <tbody>{tablePreview}</tbody>
            </table>
          </div>
          {sep}
          <div style={{ padding: '4px 10px' }}>
            <button
              className="w-full py-1 rounded text-white text-xs font-medium hover:opacity-90"
              style={{ backgroundColor: 'var(--accent)' }}
              onClick={insertTable}
            >{t('common.create')}</button>
          </div>
        </div>
      )}

      {ctxMenuMounted && ctxSubmenu === 'code' && (
        <div
          ref={ctxMenuRef}
          className={`fixed bg-[var(--bg-elevated)] backdrop-blur-xl border border-[var(--border-strong)] rounded-lg shadow-xl z-50 py-0.5 flex flex-col text-[12px] text-[var(--text-secondary)] ${
            ctxMenu ? 'animate-in fade-in zoom-in-95 duration-100 ease-out' : 'animate-out fade-out zoom-out-95 duration-100 ease-in fill-mode-forwards'
          }`}
          style={ctxMenuStyle!}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {ctxMenuItem(t('common.back'), undefined, () => setCtxSubmenu(null))}
          {sep}
          <div style={{ padding: '6px 14px' }}>
            <span className="text-[11px] text-[var(--text-dim)]">{t('editor.code.language')}</span>
            <div className="relative mt-1" ref={langDropdownRef}>
              <input
                className="w-full bg-[var(--bg-base)] border border-[var(--border-strong)] rounded px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--text-dim)]"
                placeholder={t('editor.noLanguage')}
                value={codeLang}
                onChange={(e) => setCodeLang(e.target.value)}
                onFocus={() => setShowLangDropdown(true)}
                onBlur={() => setTimeout(() => setShowLangDropdown(false), 200)}
              />
              {showLangDropdown && (
                <div className="absolute left-0 right-0 top-full mt-0.5 max-h-40 overflow-y-auto bg-[var(--bg-elevated)] backdrop-blur-xl border border-[var(--border-strong)] rounded-lg shadow-xl z-[60] animate-in fade-in zoom-in-95 duration-100 ease-out">
                  {languagesList.filter(l => !codeLang || l.label.toLowerCase().includes(codeLang.toLowerCase()) || l.value.includes(codeLang)).map((l) => (
                    <div
                      key={l.value}
                      className="menu-item enabled text-xs"
                      onMouseDown={() => { setCodeLang(l.value); setShowLangDropdown(false) }}
                    >{l.label}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {sep}
          <div style={{ padding: '4px 10px' }} className="flex gap-2">
            <button
              className="flex-1 py-1 rounded text-white text-xs font-medium hover:opacity-90"
              style={{ backgroundColor: 'var(--accent)' }}
              onClick={() => insertCodeBlock()}
            >{t('common.create')}</button>
            {codeLang && (
              <button
                className="flex-1 py-1 rounded bg-[var(--bg-base)] border border-[var(--border-strong)] text-[var(--text-secondary)] text-xs hover:bg-[var(--menu-hover-bg)]"
                onClick={() => insertCodeBlock('')}
              >{t('editor.noLanguage')}</button>
            )}
          </div>
        </div>
      )}

      {zoomToast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-lg backdrop-blur-md text-xs animate-in fade-in zoom-in-95 duration-150"
          style={{ padding: '6px 14px' }}
        >
          {zoomToast.type === 'app' && <Monitor size={14} className="text-[var(--accent)] shrink-0" />}
          {zoomToast.type === 'text' && <Type size={14} className="text-[var(--accent)] shrink-0" />}
          {zoomToast.type === 'document' && <FileText size={14} className="text-[var(--accent)] shrink-0" />}
          <span>
            {zoomToast.type === 'app' && `Интерфейс: ${zoomToast.percent}%`}
            {zoomToast.type === 'text' && `Текст: ${zoomToast.percent}%`}
            {zoomToast.type === 'document' && `Документ: ${zoomToast.percent}%`}
          </span>
        </div>
      )}

      {showRightSidebar ? (
        <div
          style={{
            right: '32px',
            width: `${Math.min(280, availableWidth)}px`,
            maxWidth: '280px',
            top: '16px',
            bottom: (state.showStats && state.statsLayoutMode === 'right') ? '84px' : '24px',
          }}
          className="absolute z-30 pointer-events-auto"
        >
          <TableOfContents
            variant="sidebar"
            toc={state.activeToc}
            suggestions={suggestions}
            tocLayoutMode={state.tocLayoutMode}
          />
        </div>
      ) : (
        <TableOfContents
          variant="floating"
          toc={state.activeToc}
          suggestions={suggestions}
          tocLayoutMode={state.tocLayoutMode}
          showStats={state.showStats}
        />
      )}

      {state.showStats && state.statsLayoutMode === 'right' && (
        <StatsToast mode="right" containerWidth={containerWidth} />
      )}
    </div>
  )
}
