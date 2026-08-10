/**
 * MarkdownEditor.tsx — Desktop wrapper around @type-club/editor EditorCore.
 * Adds desktop-specific features: zoom, data URI placeholders, search bar,
 * typewriter mode, focus mask, context menu.
 */
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { toggleMark } from 'prosemirror-commands'
import { Plugin, TextSelection, NodeSelection } from 'prosemirror-state'
import { deleteTable } from 'prosemirror-tables'
import type { EditorView } from 'prosemirror-view'

import { EditorCore, injectEditorStyles, schema, tableEditPluginKey } from '@type-club/editor'
import { useEditor } from '../context/EditorContext'
import { useAuth } from '../context/AuthContext'
import { useCollaboration } from '../hooks/useCollaboration'
import { articlesApi, collaborationApi } from '../api'
import { SearchBar, RawSearchBar, searchPlugin } from './SearchBar'
import { AddNoteModal } from './AddNoteModal'

export function MarkdownEditor() {
  const { state, dispatch, setTextZoom, setDocumentZoom } = useEditor()
  const [editorView, setEditorView] = useState<EditorView | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showSearch, setShowSearch] = useState(false)
  const lastWheelTimeRef = useRef(0)

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

  const [userRole, setUserRole] = useState<'author' | 'co_author' | 'editor' | null>(null)
  const [showAddNoteModal, setShowAddNoteModal] = useState(false)

  useEffect(() => {
    setUserRole(null)
    if (!articleId || !user) {
      return
    }
    articlesApi.get(articleId).then((art) => {
      if (art.author_id === user.id) {
        setUserRole('author')
      } else {
        collaborationApi.list(articleId)
          .then((list) => {
            const me = list.find((c) => c.user_id === user.id)
            setUserRole((me?.role as any) ?? null)
          })
          .catch(() => setUserRole(null))
      }
    }).catch(() => setUserRole(null))
  }, [articleId, user])

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
      sugAuthorName: user?.nickname || 'Советчик',
      sugColor: '#f59e0b',
      noteText: noteText.trim(),
      sugCreatedAt: new Date().toISOString(),
    })
    const tr = editorView.state.tr.insert(from, noteNode)
    tr.setMeta('suggestionAction', true)
    editorView.dispatch(tr)
    editorView.focus()
  }, [editorView, user])

  const collab = useCollaboration(articleId, user, userRole)
  const suggestionModeActive = activeTab?.suggestionMode ?? false

  useEffect(() => {
    if (userRole === 'editor' && activeTab && !activeTab.suggestionMode) {
      dispatch({ type: 'SET_SUGGESTION_MODE', payload: { tabId: activeTab.id, active: true } })
    }
  }, [userRole, activeTab, dispatch])

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
        if (e.altKey) setDocumentZoom(state.documentZoom + delta)
        else if (e.shiftKey) setTextZoom(state.textZoom + delta)
        else setDocumentZoom(state.documentZoom + delta)
      }
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [state.documentZoom, state.textZoom, setDocumentZoom, setTextZoom])

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
          if (isZero) setDocumentZoom(100)
          else setDocumentZoom(state.documentZoom + (isPlus ? 10 : -10))
        } else if (e.shiftKey && !e.altKey) {
          e.preventDefault()
          if (isZero) setTextZoom(100)
          else setTextZoom(state.textZoom + (isPlus ? 10 : -10))
        } else if (!e.shiftKey && !e.altKey) {
          e.preventDefault()
          if (isZero) window.api?.zoomReset?.()
          else if (isPlus) window.api?.zoomIn?.()
          else window.api?.zoomOut?.()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.textZoom, state.documentZoom, setTextZoom, setDocumentZoom])

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
        const domNode = editorView.nodeDOM(pos)
        if (domNode instanceof Element) {
          domNode.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      } catch { /* ignore */ }
    }
    window.addEventListener('editor-scroll-to', handler)
    return () => window.removeEventListener('editor-scroll-to', handler)
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

  const LANGUAGES = [
    { label: 'Без языка', value: '' },
    { label: 'JavaScript', value: 'javascript' },
    { label: 'TypeScript', value: 'typescript' },
    { label: 'Python', value: 'python' },
    { label: 'Bash', value: 'bash' },
    { label: 'HTML', value: 'html' },
    { label: 'CSS', value: 'css' },
    { label: 'JSON', value: 'json' },
    { label: 'SQL', value: 'sql' },
    { label: 'Rust', value: 'rust' },
    { label: 'Go', value: 'go' },
    { label: 'Java', value: 'java' },
    { label: 'C++', value: 'cpp' },
    { label: 'C', value: 'c' },
    { label: 'Ruby', value: 'ruby' },
    { label: 'PHP', value: 'php' },
    { label: 'YAML', value: 'yaml' },
    { label: 'XML', value: 'xml' },
    { label: 'Diff', value: 'diff' },
    { label: 'Markdown', value: 'markdown' },
    { label: 'Dockerfile', value: 'dockerfile' },
    { label: 'GraphQL', value: 'graphql' },
  ]

  const handleContextMenu = (e: React.MouseEvent) => {
    if (state.editorMode !== 'seamless') return
    e.preventDefault()
    setCtxTable(null)
    setCtxSubmenu(null)
    setTableCols(3)
    setTableRows(3)
    setCodeLang('')

    if (editorView) {
      try {
        const clickPos = editorView.posAtDOM(e.target as Node, 0)
        const $click = editorView.state.doc.resolve(clickPos)
        for (let d = $click.depth; d > 0; d--) {
          if ($click.node(d).type.name === 'table') {
            setCtxTable($click.before(d))
            setCtxMenu({ x: e.clientX, y: e.clientY })
            return
          }
        }
      } catch { /* ignore */ }
    }

    setCtxMenu({ x: e.clientX, y: e.clientY })
  }

  const closeCtxMenu = () => {
    setCtxMenu(null)
    setCtxSubmenu(null)
    setCtxTable(null)
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
  const ctxMenuStyle = useMemo((): React.CSSProperties | null => {
    if (!ctxMenu) return null
    const menuHeight = ctxSubmenu === 'table' ? 300 : ctxSubmenu === 'code' ? 260 : 400
    const vh = window.innerHeight
    const fitsBelow = ctxMenu.y + menuHeight <= vh - 10
    return {
      top: fitsBelow ? ctxMenu.y : undefined,
      bottom: fitsBelow ? undefined : vh - ctxMenu.y,
      left: Math.min(ctxMenu.x, window.innerWidth - 270),
      minWidth: ctxSubmenu === 'table' ? '260px' : ctxSubmenu === 'code' ? '250px' : '230px',
    }
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
    const headerCells = Array.from({ length: tableCols }, () =>
      schema.nodes.table_header.create(null, schema.nodes.paragraph.create())
    )
    const bodyRows = Array.from({ length: tableRows - 1 }, () =>
      schema.nodes.table_row.create(
        null,
        Array.from({ length: tableCols }, () =>
          schema.nodes.table_cell.create(null, schema.nodes.paragraph.create())
        )
      )
    )
    const table = schema.nodes.table.create(null, [
      schema.nodes.table_row.create(null, headerCells),
      ...bodyRows,
    ])
    insertBlockNode(table)
  }

  const insertCodeBlock = (lang?: string) => {
    const language = lang !== undefined ? lang : codeLang
    const codeBlock = schema.nodes.code_block.create({ params: language || '' })
    insertBlockNode(codeBlock)
  }

  const insertMathBlock = () => {
    const mathBlock = schema.nodes.math_block.create()
    insertBlockNode(mathBlock)
  }

  const formatItems = [
    { label: 'Жирный', hotkey: 'Ctrl+B', command: 'strong' },
    { label: 'Курсив', hotkey: 'Ctrl+I', command: 'em' },
    { label: 'Код', hotkey: 'Ctrl+E', command: 'code' },
    { label: 'Зачёркнутый', hotkey: 'Ctrl+Shift+X', command: 's' },
    { label: 'Выделение', hotkey: 'Ctrl+Shift+H', command: 'highlight' },
    { label: 'Спойлер', hotkey: 'Ctrl+Shift+S', command: 'spoiler' },
  ]

  const sep = <div className="border-t border-[var(--border-strong)] my-1" />

  const ctxMenuItem = (label: string, hotkey?: string, onClick?: () => void, extraClass?: string) => (
    <div
      className={`menu-item enabled ${extraClass || ''}`}
      onClick={onClick}
    >
      <span>{label}</span>
      {hotkey && <span className="text-[11px] text-[var(--text-dim)]">{hotkey}</span>}
    </div>
  )

  const numInput = (label: string, value: number, setValue: (v: number) => void, min = 1, max = 10) => (
    <div style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span className="text-xs text-[var(--text-dim)] w-16">{label}</span>
      <button
        className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-secondary)] hover:bg-[var(--menu-hover-bg)] disabled:opacity-30 text-sm"
        disabled={value <= min}
        onClick={() => setValue(value - 1)}
      >−</button>
      <span className="w-8 text-center text-sm text-[var(--text-secondary)]">{value}</span>
      <button
        className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-secondary)] hover:bg-[var(--menu-hover-bg)] disabled:opacity-30 text-sm"
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
            {r === 0 ? `Заголовок ${c + 1}` : `Ячейка ${c + 1}`}
          </td>
        )
      }
      rows.push(<tr key={r}>{cells}</tr>)
    }
    return rows
  }, [tableCols, tableRows])

  const isSuggestionActive = (userRole === 'editor' || suggestionModeActive) && state.editorMode === 'seamless'

  const handleScroll = useCallback((st: number) => {
    if (!activeTabId) return
    dispatch({ type: 'SAVE_SCROLL_POSITION', payload: { tabId: activeTabId, scrollTop: st } })
  }, [activeTabId, dispatch])

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-base)] rounded-[inherit]"
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
        userRole={userRole}
        userId={user?.id}
        userNickname={user?.nickname || ''}
        suggestionModeActive={suggestionModeActive}
        onEditorView={(v) => setEditorView(v)}
        className={state.typewriterMode ? 'typewriter-mode' : ''}
        focusMode={state.focusMode}
        onTocUpdate={handleTocUpdate}
        extraPlugins={[typewriterPlugin, searchPlugin]}
        containerStyle={containerStyle}
        scrollTop={activeTab?.scrollTop}
        onScroll={handleScroll}
      />

      {ctxMenu && ctxTable !== null && (
        <div
          className="fixed bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl shadow-lg z-50 py-1 flex flex-col text-[13px] text-[var(--text-secondary)]"
          style={ctxMenuStyle!}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
        >
          {ctxMenuItem('Копировать таблицу', undefined, handleTableCopy)}
          {!isSuggestionActive && (
            <>
              {ctxMenuItem('Вырезать таблицу', undefined, handleTableCut)}
              {ctxMenuItem('Редактировать таблицу', undefined, handleTableEdit)}
              {ctxMenuItem('Удалить таблицу', undefined, handleTableDelete)}
            </>
          )}
        </div>
      )}

      {ctxMenu && !ctxSubmenu && ctxTable === null && (
        <div
          className="fixed bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl shadow-lg z-50 py-1 flex flex-col text-[13px] text-[var(--text-secondary)]"
          style={ctxMenuStyle!}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
        >
          {ctxMenuItem('Копировать', 'Ctrl+C', () => handleClipboard('copy'))}
          {ctxMenuItem('Вырезать', 'Ctrl+X', () => handleClipboard('cut'))}
          {ctxMenuItem('Вставить', 'Ctrl+V', () => handleClipboard('paste'))}
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
                  <span className="text-[11px] text-[var(--text-dim)]">{item.hotkey}</span>
                </div>
              ))}
              {sep}
              {ctxMenuItem('Создать таблицу...', '▸', () => setCtxSubmenu('table'))}
              {ctxMenuItem('Создать блок кода...', '▸', () => setCtxSubmenu('code'))}
              {ctxMenuItem('Создать блок математики', undefined, insertMathBlock)}
            </>
          )}
          {isSuggestionActive && (
            <>
              {sep}
              {ctxMenuItem('Создать примечание', 'Ctrl+Q', () => {
                closeCtxMenu()
                setShowAddNoteModal(true)
              })}
            </>
          )}
        </div>
      )}

      {ctxMenu && ctxSubmenu === 'table' && (
        <div
          className="fixed bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl shadow-lg z-50 py-1 flex flex-col text-[13px] text-[var(--text-secondary)]"
          style={ctxMenuStyle!}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
        >
          {ctxMenuItem('← Назад', undefined, () => setCtxSubmenu(null))}
          {sep}
          {numInput('Столбцы', tableCols, setTableCols)}
          {numInput('Строки', tableRows, setTableRows)}
          {sep}
          <div className="overflow-x-auto" style={{ padding: '8px 20px' }}>
            <table className="w-full border-collapse border border-[var(--border-strong)]">
              <tbody>{tablePreview}</tbody>
            </table>
          </div>
          {sep}
          <div style={{ padding: '6px 12px' }}>
            <button
              className="w-full py-1.5 rounded text-white text-sm font-medium hover:opacity-90"
              style={{ backgroundColor: 'var(--accent)' }}
              onClick={insertTable}
            >Создать</button>
          </div>
        </div>
      )}

      {ctxMenu && ctxSubmenu === 'code' && (
        <div
          className="fixed bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl shadow-lg z-50 py-1 flex flex-col text-[13px] text-[var(--text-secondary)]"
          style={ctxMenuStyle!}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
        >
          {ctxMenuItem('← Назад', undefined, () => setCtxSubmenu(null))}
          {sep}
          <div style={{ padding: '8px 20px' }}>
            <span className="text-xs text-[var(--text-dim)]">Язык</span>
            <div className="relative mt-1" ref={langDropdownRef}>
              <input
                className="w-full bg-[var(--bg-base)] border border-[var(--border-strong)] rounded px-2 py-1 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-dim)]"
                placeholder="Без языка"
                value={codeLang}
                onChange={(e) => setCodeLang(e.target.value)}
                onFocus={() => setShowLangDropdown(true)}
                onBlur={() => setTimeout(() => setShowLangDropdown(false), 200)}
              />
              {showLangDropdown && (
                <div className="absolute left-0 right-0 top-full mt-0.5 max-h-40 overflow-y-auto bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded shadow-lg z-[60]">
                  {LANGUAGES.filter(l => !codeLang || l.label.toLowerCase().includes(codeLang.toLowerCase()) || l.value.includes(codeLang)).map((l) => (
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
          <div style={{ padding: '6px 12px' }} className="flex gap-2">
            <button
              className="flex-1 py-1.5 rounded text-white text-sm font-medium hover:opacity-90"
              style={{ backgroundColor: 'var(--accent)' }}
              onClick={() => insertCodeBlock()}
            >Создать</button>
            {codeLang && (
              <button
                className="flex-1 py-1.5 rounded bg-[var(--bg-base)] border border-[var(--border-strong)] text-[var(--text-secondary)] text-sm hover:bg-[var(--menu-hover-bg)]"
                onClick={() => insertCodeBlock('')}
              >Без языка</button>
            )}
          </div>
        </div>
      )}

      <AddNoteModal
        isOpen={showAddNoteModal}
        onClose={() => setShowAddNoteModal(false)}
        onSubmit={handleAddNoteSubmit}
      />
    </div>
  )
}
