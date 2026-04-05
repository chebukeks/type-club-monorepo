/**
 * MarkdownEditor.tsx — React-обёртка для ProseMirror.
 * Поддерживает три режима: Raw (textarea), Seamless (ProseMirror), Preview (read-only ProseMirror).
 */
import { useEffect, useRef, useState, useMemo } from 'react'
import 'katex/dist/katex.min.css'
import { EditorState, Plugin } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { history } from 'prosemirror-history'
import { dropCursor } from 'prosemirror-dropcursor'
import { gapCursor } from 'prosemirror-gapcursor'
import { columnResizing, tableEditing, goToNextCell } from 'prosemirror-tables'
import { keymap } from 'prosemirror-keymap'

import { parseMarkdown, serializeMarkdown } from '../editor/markdownConfig'
import { getKeymapPlugins } from '../editor/keymap'
import { getInputRulesPlugin } from '../editor/inputRules'
import { seamlessPlugin } from '../editor/seamlessPlugin'
import { syntaxHighlightPlugin } from '../editor/syntaxHighlightPlugin'
import { CodeBlockView } from '../editor/codeBlockView'
import { linkTooltipPlugin } from '../editor/linkTooltipPlugin'
import { mathActivePlugin } from '../editor/mathActivePlugin'
import { MathBlockView } from '../editor/mathBlockView'
import { getEditorStyles } from '../editor/editorTheme'
import { useEditor } from '../context/EditorContext'
import { tocPlugin } from '../editor/tocPlugin'
import { foldingPlugin } from '../editor/foldingPlugin'
import { HeadingView } from '../editor/headingView'
import { interactivePlugin } from '../editor/interactivePlugin'
import { focusModePlugin } from '../editor/focusModePlugin'

// Inject CSS один раз
let styleInjected = false
function injectStyles() {
  if (styleInjected) return
  const style = document.createElement('style')
  style.id = 'pm-editor-theme'
  style.textContent = getEditorStyles()
  document.head.appendChild(style)
  styleInjected = true
}

export function MarkdownEditor() {
  const { state, dispatch } = useEditor()
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [editorView, setEditorView] = useState<EditorView | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId)
  const content = activeTab?.content || ''
  const isOverLimitRef = useRef(false)
  const stats = useMemo(() => {
    const text = content.trim()
    const chars = text.length
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0
    return { chars, words }
  }, [content])
  
  useEffect(() => {
    if (!state.wordLimit.enabled) {
      isOverLimitRef.current = false
      return
    }
    const currentValue = state.wordLimit.type === 'chars' ? stats.chars : stats.words
    isOverLimitRef.current = currentValue > state.wordLimit.value
  }, [state.wordLimit, stats])

  const dispatchRef = useRef(dispatch)
  dispatchRef.current = dispatch

  const isTypewriterModeRef = useRef(state.typewriterMode)
  useEffect(() => {
    isTypewriterModeRef.current = state.typewriterMode
  }, [state.typewriterMode])

  const isFocusModeRef = useRef(state.focusMode)
  useEffect(() => {
    isFocusModeRef.current = state.focusMode
    if (editorView) {
      editorView.dispatch(editorView.state.tr.setMeta('focusModeUpdate', true))
    }
  }, [state.focusMode, editorView])

  // ============================================================
  // ProseMirror (Seamless / Preview режимы)
  // ============================================================
  useEffect(() => {
    if (!editorRef.current || !activeTab) return
    if (activeTab.mode === 'raw') return // Raw = textarea, не ProseMirror

    injectStyles()
    if (viewRef.current) { viewRef.current.destroy(); viewRef.current = null }

    const tabId = activeTab.id
    const initialContent = activeTab.content || ''
    const doc = parseMarkdown(initialContent)
    const isPreview = activeTab.mode === 'preview'

    // Плагин Tab для таблиц
    const tabPlugin = keymap({
      'Tab': goToNextCell(1),
      'Shift-Tab': goToNextCell(-1),
    })

    // Плагин синхронизации изменений → контекст
    const syncPlugin = new Plugin({
      props: {
        handleKeyDown(view, event) {
          if (event.key !== 'Backspace' && event.key !== 'Delete' && isOverLimitRef.current) {
            view.dom.classList.remove('shake-animation')
            void view.dom.offsetWidth // force reflow
            view.dom.classList.add('shake-animation')
          }
          return false
        }
      },
      view(_view) {
        return {
          update(view, prevState) {
            if (!view.state.doc.eq(prevState.doc)) {
              const md = serializeMarkdown(view.state.doc)
              dispatchRef.current({ type: 'UPDATE_CONTENT', payload: { tabId, content: md } })
            }
          },
        }
      },
    })

    // Плагин режима печатной машинки
    const typewriterPlugin = new Plugin({
      props: {
        handleScrollToSelection() {
          return isTypewriterModeRef.current // отключаем дефолтный скролл, если режим включен
        }
      },
      view() {
        return {
          update(view, prevState) {
            if (!isTypewriterModeRef.current) return
            if (!view.state.selection.eq(prevState.selection) || !view.state.doc.eq(prevState.doc)) {
              const { head } = view.state.selection
              let coords: { top: number, bottom: number }
              try {
                coords = view.coordsAtPos(head)
              } catch (e) {
                return
              }
              const scrollContainer = view.dom.closest('.overflow-auto') as HTMLElement
              if (!scrollContainer) return
              
              const containerRect = scrollContainer.getBoundingClientRect()
              const caretCenterY = (coords.top + coords.bottom) / 2
              const containerCenterY = containerRect.top + (containerRect.height / 2)
              
              // Для режима "Три строчки" передаем координату маске
              const maskY = caretCenterY - containerRect.top
              scrollContainer.style.setProperty('--focus-mask-y', `${maskY}px`)
              
              const offset = caretCenterY - containerCenterY
              if (Math.abs(offset) > 1) {
                // Если offset слишком большой, smooth может не успевать или дергаться. 
                // Браузеры хорошо справляются с scrollBy smooth.
                scrollContainer.scrollBy({ top: offset, behavior: 'smooth' })
              }
            }
          }
        }
      }
    })

    const focusPlugin = focusModePlugin(() => isFocusModeRef.current)

    // Набор плагинов зависит от режима
    const plugins: Plugin[] = isPreview
      ? [history(), dropCursor(), gapCursor(), syncPlugin, interactivePlugin, typewriterPlugin, focusPlugin]
      : [
        ...getKeymapPlugins(),
        getInputRulesPlugin(),
        columnResizing({}),
        tableEditing(),
        tabPlugin,
        seamlessPlugin,
        syntaxHighlightPlugin,
        linkTooltipPlugin(),
        mathActivePlugin,
        history(),
        dropCursor(),
        syncPlugin,
        foldingPlugin,
        interactivePlugin,
        typewriterPlugin,
        focusPlugin,
        tocPlugin((toc) => dispatchRef.current({ type: 'SET_ACTIVE_TOC', payload: toc })),
      ]

    const editorState = EditorState.create({ doc, plugins })


    const view = new EditorView(editorRef.current, {
      state: editorState,
      editable: () => !isPreview,
      nodeViews: isPreview ? undefined : {
        heading: (node, view, getPos) => new HeadingView(node, view, getPos),
        code_block: (node, view, getPos) => new CodeBlockView(node, view, getPos),
        math_block: (node, view, getPos) => new MathBlockView(node, view, getPos),
      },
    })

    // Добавляем CSS-класс для Preview
    if (isPreview) {
      view.dom.classList.add('preview-mode')
    }

    viewRef.current = view
    setEditorView(view)
    if (!isPreview) view.focus()

    return () => { view.destroy(); viewRef.current = null; setEditorView(null) }
  }, [activeTab?.id, activeTab?.mode, activeTab?.refreshCounter])

  // --- Обновление класса is-over-limit ---
  useEffect(() => {
    if (editorView) {
      if (isOverLimitRef.current) {
        editorView.dom.classList.add('is-over-limit')
      } else {
        editorView.dom.classList.remove('is-over-limit')
      }
    }
  }, [isOverLimitRef.current, editorView])

  // --- Скролл к заголовку ---
  useEffect(() => {
    const handleScrollTo = (e: Event) => {
      if (!editorView) return
      const customEvent = e as CustomEvent<{ pos: number }>
      const pos = customEvent.detail.pos
      try {
        const domNode = editorView.nodeDOM(pos)
        if (domNode instanceof Element) {
          domNode.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      } catch (err) {
        console.error('Ошибка при скролле к оглавлению:', err)
      }
    }
    window.addEventListener('editor-scroll-to', handleScrollTo)
    return () => window.removeEventListener('editor-scroll-to', handleScrollTo)
  }, [editorView])

  // ============================================================
  // Заглушка при отсутствии открытых вкладок
  // ============================================================
  if (!activeTab) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[var(--bg-base)]" style={{ color: 'var(--text-disabled)' }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '24px', opacity: 0.4 }}>
          <path d="M4 7V4h16v3" />
          <path d="M9 20h6" />
          <path d="M12 4v16" />
        </svg>
        <h2 style={{ fontSize: '20px', fontWeight: 300, color: 'var(--text-dim)', marginBottom: '8px' }}>Type Club</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-disabled)', marginBottom: '20px' }}>Откройте файл или папку для начала работы</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', color: 'var(--text-disabled)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <kbd style={{ padding: '2px 6px', background: 'var(--bg-hover)', borderRadius: '4px', fontSize: '11px', color: 'var(--text-dim)' }}>Ctrl+O</kbd>
            Открыть файл
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <kbd style={{ padding: '2px 6px', background: 'var(--bg-hover)', borderRadius: '4px', fontSize: '11px', color: 'var(--text-dim)' }}>Ctrl+Shift+O</kbd>
            Открыть папку
          </span>
        </div>
      </div>
    )
  }

  // ============================================================
  // Raw-режим — textarea
  // ============================================================
  if (activeTab.mode === 'raw') {
    return (
      <div className="flex-1 overflow-auto bg-[var(--bg-base)]">
        <textarea
          ref={textareaRef}
          className="w-full h-full resize-none outline-none bg-transparent text-[var(--editor-text)] p-6"
          style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            fontSize: '14px',
            lineHeight: '1.6',
            maxWidth: '860px',
            margin: '0 auto',
            display: 'block',
            tabSize: 2,
          }}
          value={activeTab.content}
          onChange={(e) => {
            dispatch({ type: 'UPDATE_CONTENT', payload: { tabId: activeTab.id, content: e.target.value } })
          }}
          spellCheck={false}
        />
      </div>
    )
  }

  // ============================================================
  // Seamless / Preview — ProseMirror
  // ============================================================
  
  const focusClass = state.focusMode === 'paragraph' ? 'focus-mode-paragraph' 
    : state.focusMode === 'sentence' ? 'focus-mode-sentence' 
    : state.focusMode === 'lines' ? 'focus-mode-lines' : ''
    
  return (
    <div 
      className={`flex-1 overflow-auto bg-[var(--bg-base)] ${state.typewriterMode ? 'typewriter-mode' : ''} ${focusClass}`}
      style={{
        maskImage: state.focusMode === 'lines' ? 'linear-gradient(to bottom, transparent calc(var(--focus-mask-y, 50%) - 100px), black calc(var(--focus-mask-y, 50%) - 30px), black calc(var(--focus-mask-y, 50%) + 30px), transparent calc(var(--focus-mask-y, 50%) + 100px))' : 'none',
        WebkitMaskImage: state.focusMode === 'lines' ? 'linear-gradient(to bottom, transparent calc(var(--focus-mask-y, 50%) - 100px), black calc(var(--focus-mask-y, 50%) - 30px), black calc(var(--focus-mask-y, 50%) + 30px), transparent calc(var(--focus-mask-y, 50%) + 100px))' : 'none',
        transition: 'mask-image 0.3s'
      }}
    >
      <div 
        ref={editorRef} 
        className="h-full w-full" 
      />
    </div>
  )
}
