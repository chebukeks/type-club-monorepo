/**
 * App.tsx — Корневой компонент приложения Type Club.
 * Собирает макет: TitleBar, Sidebar, TabBar, MarkdownEditor.
 * Оборачивает всё в EditorProvider для управления состоянием.
 */
import { EditorProvider } from './context/EditorContext'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { TabBar } from './components/TabBar'
import { MarkdownEditor } from './components/MarkdownEditor'

/** Внутренний компонент — макет приложения */
function AppLayout() {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)]">
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
