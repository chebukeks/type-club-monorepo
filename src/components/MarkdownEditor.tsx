/**
 * MarkdownEditor.tsx — React-обёртка для ProseMirror.
 *
 * Инициализирует ProseMirror EditorView с:
 * - Markdown-парсингом/сериализацией
 * - Seamless-режимом (Typora-стиль)
 * - Таблицами (prosemirror-tables)
 * - Горячими клавишами (Ctrl+B, Ctrl+I, Ctrl+S и т.д.)
 *
 * АРХИТЕКТУРА:
 * - При монтировании: parse(markdown) → PM doc
 * - При изменении: serialize(doc) → dispatch(UPDATE_CONTENT)
 * - EditorContext хранит content как string (markdown)
 */
import { useEffect, useRef } from 'react'
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
  const { state, dispatch, saveActiveFile } = useEditor()
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  // Активная вкладка
  const activeTab = state.tabs.find((t) => t.id === state.activeTabId)

  // Рефы для актуальных callback'ов (решает stale closure)
  const saveRef = useRef(saveActiveFile)
  saveRef.current = saveActiveFile

  const dispatchRef = useRef(dispatch)
  dispatchRef.current = dispatch

  // ============================================================
  // Инициализация / пересоздание редактора при смене вкладки
  // ============================================================
  useEffect(() => {
    if (!editorRef.current || !activeTab) return

    // Inject CSS
    injectStyles()

    // Уничтожаем предыдущий экземпляр
    if (viewRef.current) {
      viewRef.current.destroy()
    }

    const tabId = activeTab.id
    const initialContent = activeTab.content || ''

    // Парсим markdown → ProseMirror doc
    const doc = parseMarkdown(initialContent)

    // Плагин для Ctrl+S (через ref)
    const savePlugin = keymap({
      'Mod-s': () => {
        saveRef.current()
        return true
      },
    })

    // Плагин Tab для таблиц
    const tabPlugin = keymap({
      'Tab': goToNextCell(1),
      'Shift-Tab': goToNextCell(-1),
    })

    // Плагин для отслеживания изменений → обновление контекста
    const syncPlugin = new Plugin({
      view() {
        return {
          update(view, prevState) {
            if (!view.state.doc.eq(prevState.doc)) {
              const md = serializeMarkdown(view.state.doc)
              dispatchRef.current({
                type: 'UPDATE_CONTENT',
                payload: { tabId, content: md },
              })
            }
          },
        }
      },
    })

    // Создаём ProseMirror state
    const editorState = EditorState.create({
      doc,
      plugins: [
        // Наши кастомные плагины
        savePlugin,
        ...getKeymapPlugins(),
        getInputRulesPlugin(),

        // Таблицы
        columnResizing({}),
        tableEditing(),
        tabPlugin,

        // Seamless-режим и подсветка кода
        seamlessPlugin,
        syntaxHighlightPlugin,

        // Стандартные плагины
        history(),
        dropCursor(),
        gapCursor(),

        // Синхронизация с React
        syncPlugin,
      ],
    })

    // Создаём EditorView
    const view = new EditorView(editorRef.current, {
      state: editorState,
      nodeViews: {
        code_block: (node, view, getPos) => new CodeBlockView(node, view, getPos)
      }
    })

    viewRef.current = view
    view.focus()

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [activeTab?.id])

  // ============================================================
  // Заглушка при отсутствии открытых вкладок
  // ============================================================
  if (!activeTab) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#1a1b1e] text-[#3a3d44]">
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mb-6 opacity-40"
        >
          <path d="M4 7V4h16v3" />
          <path d="M9 20h6" />
          <path d="M12 4v16" />
        </svg>
        <h2 className="text-xl font-light text-[#4a4d54] mb-2">Type Club</h2>
        <p className="text-[13px] text-[#3a3d44]">
          Откройте файл или папку для начала работы
        </p>
        <div className="mt-6 flex flex-col gap-2 text-[12px] text-[#3a3d44]">
          <span className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-[#232428] rounded text-[11px] text-[#6a6e78]">Ctrl+B</kbd>
            Жирный
          </span>
          <span className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-[#232428] rounded text-[11px] text-[#6a6e78]">Ctrl+I</kbd>
            Курсив
          </span>
          <span className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-[#232428] rounded text-[11px] text-[#6a6e78]">Ctrl+S</kbd>
            Сохранить
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto bg-[#1a1b1e]">
      <div ref={editorRef} className="h-full w-full" />
    </div>
  )
}
