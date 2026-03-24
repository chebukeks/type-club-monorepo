/**
 * MarkdownEditor.tsx — React-обёртка для CodeMirror 6.
 * Инициализирует экземпляр CodeMirror с поддержкой:
 * - Seamless Markdown (скрытие/показ спецсимволов)
 * - Кастомная тёмная тема
 * - Markdown-подсветка синтаксиса
 * - Горячие клавиши (Ctrl+S для сохранения)
 */
import { useEffect, useRef, useCallback } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { editorTheme } from '../editor/editorTheme'
import { seamlessMarkdownPlugin } from '../editor/seamlessMarkdown'
import { useEditor } from '../context/EditorContext'

export function MarkdownEditor() {
  const { state, dispatch, saveActiveFile } = useEditor()
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  // Получаем активную вкладку
  const activeTab = state.tabs.find((t) => t.id === state.activeTabId)

  // Функция сохранения через горячую клавишу
  const handleSave = useCallback(() => {
    saveActiveFile()
    return true // Предотвращаем стандартное поведение браузера
  }, [saveActiveFile])

  // ============================================================
  // Инициализация / пересоздание редактора при смене вкладки
  // ============================================================
  useEffect(() => {
    if (!editorRef.current || !activeTab) return

    // Уничтожаем предыдущий экземпляр
    if (viewRef.current) {
      viewRef.current.destroy()
    }

    // Создаём новое состояние CodeMirror
    const startState = EditorState.create({
      doc: activeTab.content,
      extensions: [
        // Базовые расширения
        lineNumbers(),
        highlightActiveLine(),
        history(),

        // Горячие клавиши
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          { key: 'Mod-s', run: handleSave },
        ]),

        // Markdown-парсер (для подсветки и автодополнения)
        markdown(),

        // Seamless-режим (скрытие/показ Markdown-символов)
        seamlessMarkdownPlugin,

        // Кастомная тема
        editorTheme,

        // Обработчик изменений — обновляем состояние React
        EditorView.updateListener.of((update) => {
          if (update.docChanged && activeTab) {
            dispatch({
              type: 'UPDATE_CONTENT',
              payload: {
                tabId: activeTab.id,
                content: update.state.doc.toString(),
              },
            })
          }
        }),
      ],
    })

    // Создаём экземпляр EditorView
    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    })

    viewRef.current = view

    // Автофокус
    view.focus()

    // Очистка при размонтировании
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [activeTab?.id]) // Пересоздаём только при смене вкладки

  // ============================================================
  // Заглушка, когда нет открытых вкладок
  // ============================================================
  if (!activeTab) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#1a1b1e] text-[#3a3d44]">
        {/* Логотип */}
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
            <kbd className="px-1.5 py-0.5 bg-[#232428] rounded text-[11px] text-[#6a6e78]">Ctrl+S</kbd>
            Сохранить
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-hidden bg-[#1a1b1e]">
      <div ref={editorRef} className="h-full w-full" />
    </div>
  )
}
