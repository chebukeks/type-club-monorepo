/**
 * MarkdownEditor.tsx — Desktop wrapper around @type-club/editor EditorCore.
 * Adds desktop-specific features: zoom, data URI placeholders, search bar,
 * typewriter mode, focus mask, context menu.
 */
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { toggleMark } from 'prosemirror-commands'
import { Plugin } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

import { EditorCore, injectEditorStyles, schema } from '@type-club/editor'
import { useEditor } from '../context/EditorContext'
import { SearchBar, RawSearchBar } from './SearchBar'

export function MarkdownEditor() {
  const { state, dispatch, setTextZoom, setDocumentZoom } = useEditor()
  const [editorView, setEditorView] = useState<EditorView | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
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

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId)
  const content = activeTab?.content || ''

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

  // ── Content handlers ──
  const handleChange = useCallback((md: string) => {
    if (!state.activeTabId) return
    dispatch({ type: 'UPDATE_CONTENT', payload: { tabId: state.activeTabId, content: md } })
  }, [state.activeTabId, dispatch])

  useEffect(() => {
    if (state.editorMode === 'raw' && state.activeTabId) {
      if (rawTabIdRef.current !== state.activeTabId || rawContent === null) {
        rawTabIdRef.current = state.activeTabId
        const replaced = replaceDataUris(content)
        setRawContent(replaced)
      }
    }
  }, [state.editorMode, state.activeTabId, content, replaceDataUris, rawContent])

  const handleRawChange = useCallback((text: string) => {
    setRawContent(text)
    rawTabIdRef.current = state.activeTabId
    if (rawSyncTimerRef.current) clearTimeout(rawSyncTimerRef.current)
    rawSyncTimerRef.current = setTimeout(() => {
      flushRawContentRef.current?.()
    }, 1500)
  }, [state.activeTabId])

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

  // ── Context menu ──
  const handleContextMenu = (e: React.MouseEvent) => {
    if (state.editorMode !== 'seamless') return
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }

  const applyFormat = (markName: string) => {
    if (!editorView) return
    const mark = (schema.marks as Record<string, unknown>)[markName]
    if (mark) {
      toggleMark(mark as import('prosemirror-model').MarkType)(editorView.state, editorView.dispatch)
      editorView.focus()
    }
    setCtxMenu(null)
  }

  const formatItems = [
    { label: 'Bold', hotkey: 'Ctrl+B', command: 'strong' },
    { label: 'Italic', hotkey: 'Ctrl+I', command: 'em' },
    { label: 'Code', hotkey: 'Ctrl+E', command: 'code' },
    { label: 'Strikethrough', hotkey: 'Ctrl+Shift+X', command: 's' },
    { label: 'Highlight', hotkey: 'Ctrl+Shift+H', command: 'highlight' },
  ]

  // ── Render ──
  return (
    <div
      className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-base)]"
      onContextMenu={handleContextMenu}
      onClick={() => setCtxMenu(null)}
    >
      {state.editorMode !== 'raw' && showSearch && editorView && (
        <SearchBar view={editorView} onClose={() => setShowSearch(false)} />
      )}

      {state.editorMode === 'raw' && showSearch && textareaRef.current && activeTab && (
        <RawSearchBar textarea={textareaRef.current} content={content} onClose={() => setShowSearch(false)} />
      )}

      <EditorCore
        content={state.editorMode === 'raw' ? (rawContent ?? content) : content}
        editorMode={state.editorMode}
        onChange={state.editorMode === 'raw' ? handleRawChange : handleChange}
        textZoom={state.textZoom}
        documentZoom={state.documentZoom}
        readOnly={state.editorMode === 'preview'}
        onEditorView={(v) => setEditorView(v)}
        className={state.typewriterMode ? 'typewriter-mode' : ''}
        focusMode={state.focusMode}
        onTocUpdate={handleTocUpdate}
        extraPlugins={[typewriterPlugin]}
        containerStyle={containerStyle}
      />

      {ctxMenu && (
        <div
          className="fixed bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-md shadow-lg z-50 py-1 flex flex-col text-[13px] text-[var(--text-secondary)]"
          style={{ top: ctxMenu.y, left: ctxMenu.x, minWidth: '220px' }}
          onContextMenu={(e) => e.preventDefault()}
        >
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
        </div>
      )}
    </div>
  )
}
