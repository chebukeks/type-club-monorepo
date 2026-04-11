/**
 * MarkdownEditor.tsx — React-обёртка для ProseMirror.
 * Поддерживает три режима: Raw (textarea), Seamless (ProseMirror), Preview (read-only ProseMirror).
 */
import { useEffect, useRef, useState, useMemo } from 'react'
import 'katex/dist/katex.min.css'
import katex from 'katex'
import { EditorState, Plugin } from 'prosemirror-state'
import { EditorView, NodeView } from 'prosemirror-view'
import { Node as PMNode } from 'prosemirror-model'
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

/**
 * Минимальный NodeView для math_inline в Preview-режиме.
 * Показывает только отрендеренный KaTeX, скрывая исходный текст.
 */
class MathInlinePreviewView implements NodeView {
  dom: HTMLElement
  node: PMNode

  constructor(node: PMNode) {
    this.node = node
    this.dom = document.createElement('span')
    this.dom.className = 'math-inline-preview'
    this.dom.contentEditable = 'false'
    this.renderMath()
  }

  renderMath() {
    const text = this.node.textContent?.trim() || ''
    this.dom.innerHTML = ''
    if (!text) {
      this.dom.innerHTML = '<span style="color: grey; opacity: 0.5;">Empty Math</span>'
      return
    }
    try {
      katex.render(text, this.dom, { throwOnError: false, displayMode: false })
    } catch (e) {
      this.dom.textContent = text
    }
  }

  update(node: PMNode) {
    if (node.type !== this.node.type) return false
    this.node = node
    this.renderMath()
    return true
  }

  // Нет contentDOM — ProseMirror не будет управлять содержимым
  stopEvent() { return true }
  ignoreMutation() { return true }
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

    // При включении режима печатной машинки — сразу прокрутить к каретке,
    // иначе padding-top: 70vh сдвигает контент вниз и виден огромный пробел.
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
          if (Math.abs(offset) > 1) {
            scrollContainer.scrollBy({ top: offset })
          }
        } catch {
          // Если coordsAtPos не удался — прокрутить к началу контента
          const paddingTop = parseFloat(getComputedStyle(editorView.dom).paddingTop) || 0
          scrollContainer.scrollTop = Math.max(0, paddingTop - scrollContainer.clientHeight / 2)
        }
      })
    }
  }, [state.typewriterMode, editorView])

  const isFocusModeRef = useRef(state.focusMode)
  useEffect(() => {
    isFocusModeRef.current = state.focusMode
    if (editorView && !editorView.isDestroyed) {
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
    console.log('[EDITOR] Creating ProseMirror for tab:', activeTab.id, 'mode:', activeTab.mode)

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

    // Плагин режима печатной машинки + отслеживание позиции маски "три строчки"
    const isMouseSelectingRef = { current: false }
    // Абсолютная позиция каретки в документе (относительно верха контента, а не viewport)
    const caretDocY = { current: -1 }

    /** Обновить CSS-переменную позиции маски по сохранённой document-позиции каретки */
    function updateFocusMaskFromDocY(scrollContainer: HTMLElement) {
      if (caretDocY.current < 0) return
      const maskY = caretDocY.current - scrollContainer.scrollTop
      scrollContainer.style.setProperty('--focus-mask-y', `${maskY}px`)
    }

    /** Сохранить document-позицию каретки и обновить маску */
    function updateCaretDocY(view: EditorView) {
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
      // Сохраняем позицию каретки в координатах документа (не viewport)
      caretDocY.current = (caretCenterY - containerRect.top) + scrollContainer.scrollTop
      updateFocusMaskFromDocY(scrollContainer)

      return { scrollContainer, caretCenterY, containerRect }
    }

    function typewriterScrollToHead(view: EditorView) {
      const result = updateCaretDocY(view)
      if (!result) return

      const { scrollContainer, caretCenterY, containerRect } = result
      const containerCenterY = containerRect.top + (containerRect.height / 2)
      const offset = caretCenterY - containerCenterY
      if (Math.abs(offset) > 1) {
        scrollContainer.scrollBy({ top: offset, behavior: 'smooth' })
      }
    }

    const typewriterPlugin = new Plugin({
      props: {
        handleScrollToSelection() {
          return isTypewriterModeRef.current
        },
        handleDOMEvents: {
          mousedown: () => {
            isMouseSelectingRef.current = true
            return false
          },
          mouseup: (_view) => {
            isMouseSelectingRef.current = false
            if (isTypewriterModeRef.current) {
              requestAnimationFrame(() => typewriterScrollToHead(_view))
            } else {
              // Без typewriter — просто обновляем позицию маски
              requestAnimationFrame(() => updateCaretDocY(_view))
            }
            return false
          },
        },
      },
      view() {
        let scrollHandler: (() => void) | null = null
        let scrollContainer: HTMLElement | null = null

        return {
          update(view, prevState) {
            // Привязываем scroll listener при первом update
            if (!scrollHandler) {
              scrollContainer = view.dom.closest('.overflow-auto') as HTMLElement
              if (scrollContainer) {
                scrollHandler = () => updateFocusMaskFromDocY(scrollContainer!)
                scrollContainer.addEventListener('scroll', scrollHandler, { passive: true })
              }
            }

            const selectionOrDocChanged = !view.state.selection.eq(prevState.selection) || !view.state.doc.eq(prevState.doc)

            if (selectionOrDocChanged && !isMouseSelectingRef.current) {
              if (isTypewriterModeRef.current) {
                typewriterScrollToHead(view)
              } else {
                // Без typewriter — обновляем только позицию маски
                updateCaretDocY(view)
              }
            }
          },
          destroy() {
            if (scrollHandler && scrollContainer) {
              scrollContainer.removeEventListener('scroll', scrollHandler)
            }
          }
        }
      }
    })

    const focusPlugin = focusModePlugin(() => isFocusModeRef.current)

    // Набор плагинов зависит от режима
    const plugins: Plugin[] = isPreview
      ? [history(), dropCursor(), gapCursor(), syncPlugin, foldingPlugin, interactivePlugin, typewriterPlugin, focusPlugin]
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
      nodeViews: {
        heading: (node, view, getPos) => new HeadingView(node, view, getPos),
        code_block: (node, view, getPos) => new CodeBlockView(node, view, getPos),
        math_block: (node, view, getPos) => new MathBlockView(node, view, getPos),
        ...(isPreview ? {
          // В Preview режиме math_inline рендерим только KaTeX (без UI редактирования)
          math_inline: (node: PMNode) => new MathInlinePreviewView(node),
        } : {}),
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
        <svg 
          width="80" 
          height="80" 
          viewBox="0 0 1024 1024" 
          fill="var(--text-disabled)" 
          style={{ marginBottom: '24px', opacity: 0.5 }}
        >
          <path d="m512,32c-164.69,0-309.99,82.96-396.44,209.35h506.04v168.49h-229.66v238.43c7.94-22.8,18.86-44.76,32.85-65.86,29.77-44.92,70.94-81.63,123.54-110.16,45.89-24.89,91.65-39.18,137.28-42.91,45.63-3.71,88.93,3.13,129.9,20.49l-46.01,130.76c-53.77-21.56-103.85-19.78-150.21,5.37-27.25,14.78-48.27,33.93-63.06,57.41-14.79,23.49-22.15,49.29-22.06,77.39.08,28.11,7.78,56.26,23.08,84.46,15.3,28.21,34.7,50.01,58.21,65.4,23.51,15.41,49.14,23.32,76.9,23.72,27.75.42,55.26-6.77,82.51-21.55,46.37-25.15,75.18-66.14,86.43-122.98l59.16,14.38c45.35-73.29,71.55-159.68,71.55-252.2,0-265.1-214.9-480-480-480ZM32,512c0,136,56.57,258.77,147.45,346.11v-448.27H42.93c-7.14,32.93-10.93,67.1-10.93,102.16Zm381.82,371.01c-8.88-16.37-16.15-32.87-21.88-49.5v143.35c38.37,9.88,78.6,15.14,120.06,15.14.17,0,.34,0,.52,0-40.65-26.32-73.56-62.64-98.69-108.98Z" />
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
        maskImage: state.focusMode === 'lines' ? 'linear-gradient(to bottom, rgba(0, 0, 0, 0.3) calc(var(--focus-mask-y, 50%) - 50px), black calc(var(--focus-mask-y, 50%) - 30px), black calc(var(--focus-mask-y, 50%) + 30px), rgba(0, 0, 0, 0.3) calc(var(--focus-mask-y, 50%) + 50px))' : 'none',
        WebkitMaskImage: state.focusMode === 'lines' ? 'linear-gradient(to bottom, rgba(0, 0, 0, 0.3) calc(var(--focus-mask-y, 50%) - 50px), black calc(var(--focus-mask-y, 50%) - 30px), black calc(var(--focus-mask-y, 50%) + 30px), rgba(0, 0, 0, 0.3) calc(var(--focus-mask-y, 50%) + 50px))' : 'none',
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
