/**
 * TitleBar.tsx — Кастомная шапка окна (frameless window).
 * Содержит:
 * - Название приложения
 * - Drag region для перемещения окна
 * - Кнопки управления окном (свернуть, развернуть, закрыть)
 */
import { useEditor } from '../context/EditorContext'
import { MenuBar } from './MenuBar'

export function TitleBar() {
  const { saveActiveFile } = useEditor()

  return (
    <div className="flex items-center h-9 bg-[#1e1f22] border-b border-[#2d2e32] select-none">
      {/* Область перетаскивания окна */}
      <div
        className="flex-1 flex items-center h-full px-3"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Логотип */}
        <div className="flex items-center gap-2 text-[#a0a4ab] text-xs font-medium tracking-wide mr-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[#6c8cff]"
          >
            <path d="M4 7V4h16v3" />
            <path d="M9 20h6" />
            <path d="M12 4v16" />
          </svg>
          {/* Убираем текст 'Type Club', так как у нас теперь меню как в VS Code */}
        </div>
        
        {/* Интерактивное Меню (File, Edit...) */}
        <MenuBar />

        {/* Горячие клавиши (показываем как подсказку) */}
        <div
          className="ml-auto flex items-center gap-3 pr-4"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={saveActiveFile}
            className="text-[10px] text-[#6a6e78] hover:text-[#a0a4ab] transition-colors flex items-center gap-1"
            title="Сохранить (Ctrl+S)"
          >
            <kbd className="px-1 py-0.5 bg-[#2a2b30] rounded text-[9px]">Ctrl+S</kbd>
            <span>Сохранить</span>
          </button>
        </div>
      </div>

      {/* Кнопки управления окном */}
      <div
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Свернуть */}
        <button
          onClick={() => window.api.minimizeWindow()}
          className="w-11 h-full flex items-center justify-center text-[#6a6e78] hover:bg-[#2a2d33] hover:text-[#d0d4db] transition-colors"
        >
          <svg width="10" height="1" viewBox="0 0 10 1">
            <rect width="10" height="1" fill="currentColor" />
          </svg>
        </button>

        {/* Развернуть */}
        <button
          onClick={() => window.api.maximizeWindow()}
          className="w-11 h-full flex items-center justify-center text-[#6a6e78] hover:bg-[#2a2d33] hover:text-[#d0d4db] transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="0.5" y="0.5" width="9" height="9" />
          </svg>
        </button>

        {/* Закрыть */}
        <button
          onClick={() => window.api.closeWindow()}
          className="w-11 h-full flex items-center justify-center text-[#6a6e78] hover:bg-[#e81123] hover:text-white transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
            <line x1="1" y1="1" x2="9" y2="9" />
            <line x1="9" y1="1" x2="1" y2="9" />
          </svg>
        </button>
      </div>
    </div>
  )
}
