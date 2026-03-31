/**
 * MarkdownEditor.tsx — React-обёртка для ProseMirror.
 * Поддерживает три режима: Raw (textarea), Seamless (ProseMirror), Preview (read-only ProseMirror).
 */
import { useEffect, useRef } from 'react'
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId)
  const dispatchRef = useRef(dispatch)
  dispatchRef.current = dispatch

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
      view() {
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

    // Набор плагинов зависит от режима
    const plugins: Plugin[] = isPreview
      ? [history(), dropCursor(), gapCursor(), syncPlugin]
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
          gapCursor(),
          syncPlugin,
        ]

    const editorState = EditorState.create({ doc, plugins })


    const view = new EditorView(editorRef.current, {
      state: editorState,
      editable: () => !isPreview,
      nodeViews: isPreview ? undefined : {
        code_block: (node, view, getPos) => new CodeBlockView(node, view, getPos),
        math_block: (node, view, getPos) => new MathBlockView(node, view, getPos),
      },
      handleClickOn: isPreview ? (_view, _pos, _node, _nodePos, event) => {
        // В Preview-режиме ссылки кликабельны
        const target = event.target as HTMLElement
        const link = target.closest('a')
        if (link) {
          const href = link.getAttribute('href')
          if (href) window.open(href, '_blank')
          return true
        }
        return false
      } : undefined,
    })

    // Добавляем CSS-класс для Preview
    if (isPreview) {
      view.dom.classList.add('preview-mode')
    }

    viewRef.current = view
    if (!isPreview) view.focus()

    return () => { view.destroy(); viewRef.current = null }
  }, [activeTab?.id, activeTab?.mode, activeTab?.refreshCounter])

  // ============================================================
  // Заглушка при отсутствии открытых вкладок
  // ============================================================
  if (!activeTab) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[var(--bg-base)] text-[var(--text-disabled)]">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-6 opacity-40">
          <path d="M4 7V4h16v3" />
          <path d="M9 20h6" />
          <path d="M12 4v16" />
        </svg>
        <h2 className="text-xl font-light text-[var(--text-dim)] mb-2">Type Club</h2>
        <p className="text-[13px] text-[var(--text-disabled)]">Откройте файл или папку для начала работы</p>
        <div className="mt-6 flex flex-col gap-2 text-[12px] text-[var(--text-disabled)]">
          <span className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-[var(--bg-hover)] rounded text-[11px] text-[var(--text-dim)]">Ctrl+O</kbd>
            Открыть файл
          </span>
          <span className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-[var(--bg-hover)] rounded text-[11px] text-[var(--text-dim)]">Ctrl+N</kbd>
            Создать файл
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
  return (
    <div className="flex-1 overflow-auto bg-[var(--bg-base)]">
      <div ref={editorRef} className="h-full w-full" />
    </div>
  )
}
