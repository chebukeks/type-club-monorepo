/**
 * MarkdownEditor.tsx — Desktop wrapper around @type-club/editor EditorCore.
 * Adds desktop-specific features: zoom, data URI placeholders, search bar, context menu.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { toggleMark } from 'prosemirror-commands'
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

  const docScale = state.documentZoom / 100
  const docScaleRef = useRef(docScale)
  useEffect(() => { docScaleRef.current = docScale }, [docScale])

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId)
  const content = activeTab?.content || ''

  // Data URI → placeholder replacement
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

  // Zoom handlers
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const now = Date.now()
      if (now - lastWheelTimeRef.current < 100) return
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        lastWheelTimeRef.current = now
        const delta = e.deltaY > 0 ? -5 : 5
        setDocumentZoom(Math.max(30, Math.min(300, state.documentZoom + delta)))
      }
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [state.documentZoom, setDocumentZoom])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') { e.preventDefault(); setTextZoom(Math.min(300, state.textZoom + 5)) }
        if (e.key === '-') { e.preventDefault(); setTextZoom(Math.max(30, state.textZoom - 5)) }
        if (e.key === '0') { e.preventDefault(); setTextZoom(100); setDocumentZoom(100) }
        if (e.key === 'f') { e.preventDefault(); setShowSearch(s => !s) }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [state.textZoom, state.documentZoom, setTextZoom, setDocumentZoom])

  // Content change handler
  const handleChange = useCallback((md: string) => {
    if (!state.activeTabId) return
    if (state.editorMode === 'raw') {
      dispatch({ type: 'UPDATE_CONTENT', payload: { tabId: state.activeTabId, content: md } })
    } else {
      dispatch({ type: 'UPDATE_CONTENT', payload: { tabId: state.activeTabId, content: md } })
    }
  }, [state.activeTabId, state.editorMode, dispatch])

  // Raw mode content sync
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

  // Context menu
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
      />

      {ctxMenu && (
        <div
          className="fixed bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-lg shadow-xl z-50 py-1 flex flex-col text-sm"
          style={{ top: ctxMenu.y, left: ctxMenu.x, minWidth: '220px' }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {formatItems.map((item) => (
            <button
              key={item.command}
              className="flex items-center justify-between px-3 py-2 hover:bg-[var(--bg-hover)] text-left"
              onClick={() => applyFormat(item.command)}
            >
              <span style={{ color: 'var(--text-primary)' }}>{item.label}</span>
              <span style={{ color: 'var(--text-muted)' }} className="text-xs">{item.hotkey}</span>
            </button>
          ))}
          <div className="border-t border-[var(--border-strong)] my-1" />
          <div className="px-3 py-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Text: {state.textZoom}% | Doc: {state.documentZoom}%
          </div>
        </div>
      )}
    </div>
  )
}
