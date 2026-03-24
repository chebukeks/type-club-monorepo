/**
 * App.tsx — Корневой компонент приложения Type Club.
 * Собирает макет: TitleBar, Sidebar, TabBar, MarkdownEditor.
 * Оборачивает всё в EditorProvider для управления состоянием.
 */
import { useEffect } from 'react'
import { EditorProvider, useEditor } from './context/EditorContext'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { TabBar } from './components/TabBar'
import { MarkdownEditor } from './components/MarkdownEditor'

/** Внутренний компонент с доступом к контексту */
function AppLayout() {
  const { saveActiveFile } = useEditor()

  // Глобальный обработчик Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveActiveFile()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [saveActiveFile])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#1a1b1e] text-[#e1e1e3]">
      {/* Шапка окна */}
      <TitleBar />

      {/* Основная область: сайдбар + редактор */}
      <div className="flex flex-1 overflow-hidden">
        {/* Левая панель — файловый проводник */}
        <Sidebar />

        {/* Правая панель — вкладки + редактор */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <TabBar />
          <MarkdownEditor />
        </div>
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
