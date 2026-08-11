/**
 * App.tsx — Корневой компонент приложения Type Club.
 * Собирает макет: TitleBar, Sidebar, TabBar, MarkdownEditor, StatsToast.
 * Оборачивает всё в EditorProvider для управления состоянием.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { EditorProvider, useEditor } from './context/EditorContext'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { TabBar } from './components/TabBar'
import { MarkdownEditor } from './components/MarkdownEditor'
import { StatsToast } from './components/StatsToast'

const DEFAULT_SIDEBAR_WIDTH = 240
const MIN_SIDEBAR_WIDTH = 140
const MAX_SIDEBAR_WIDTH = 500

/** Внутренний компонент — макет приложения */
function AppLayout() {
  const { state } = useEditor()
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  // Загрузить ширину из store
  useEffect(() => {
    ;(async () => {
      try {
        const saved = await window.api.storeGet('sidebarWidth') as number | undefined
        if (saved && saved >= MIN_SIDEBAR_WIDTH && saved <= MAX_SIDEBAR_WIDTH) {
          setSidebarWidth(saved)
        }
      } catch { /* ignore */ }
    })()
  }, [])

  // Сохранить ширину в store (debounced)
  const saveWidth = useCallback((w: number) => {
    try { window.api.storeSet('sidebarWidth', w) } catch { /* ignore */ }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    startX.current = e.clientX
    startWidth.current = sidebarWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [sidebarWidth])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const delta = e.clientX - startX.current
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, startWidth.current + delta))
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      if (!isResizing.current) return
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      // Сохраняем финальную ширину
      const finalWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, sidebarWidth))
      saveWidth(finalWidth)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [sidebarWidth, saveWidth])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)]">
      {/* Шапка окна */}
      <TitleBar />

      {/* Основная область: сайдбар + ручка ресайза + редактор */}
      <div className="flex flex-1 overflow-hidden bg-[var(--bg-surface)] relative">
        {/* Левая панель — файловый проводник */}
        {state.sidebarOpen && <Sidebar width={sidebarWidth} />}

        {/* Ручка ресайза */}
        {state.sidebarOpen && (
          <div
            onMouseDown={handleMouseDown}
            className="w-[4px] flex-shrink-0 cursor-col-resize hover:bg-[var(--accent)] transition-colors duration-150"
            style={{ marginLeft: '-2px', marginRight: '-2px', zIndex: 10 }}
          />
        )}

        {/* Правая панель — вкладки + редактор */}
        <div className="relative flex flex-col flex-1 overflow-hidden p-2 pt-0 bg-[var(--bg-surface)]">
          {state.tabBarOpen && <TabBar />}
          <div className="flex-1 overflow-hidden rounded-xl border border-[var(--border-default)] shadow-xs bg-[var(--bg-base)] flex flex-col relative isolate" style={{ backgroundClip: 'padding-box' }}>
            <MarkdownEditor />
          </div>
        </div>

        {/* Плашка статистики в сайдбаре */}
        {state.showStats && state.statsLayoutMode === 'sidebar' && state.sidebarOpen && (
          <StatsToast mode="sidebar" sidebarWidth={sidebarWidth} />
        )}
      </div>
    </div>
  )
}

/** Корневой компонент с провайдером */
function App() {
  return (
    <EditorProvider>
      <AppLayout />
    </EditorProvider>
  )
}

export default App
