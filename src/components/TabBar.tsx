/**
 * TabBar.tsx — Панель вкладок открытых файлов.
 * Отображает:
 * - Список вкладок с именами файлов
 * - Индикатор несохранённых изменений (точка)
 * - Кнопку закрытия вкладки
 */
import { useEditor } from '../context/EditorContext'

export function TabBar() {
  const { state, dispatch } = useEditor()

  // Если нет вкладок — не рендерим панель
  if (state.tabs.length === 0) return null

  return (
    <div className="flex items-end h-9 bg-[#1e1f22] border-b border-[#2d2e32] overflow-x-auto">
      {state.tabs.map((tab) => {
        const isActive = tab.id === state.activeTabId

        return (
          <div
            key={tab.id}
            onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: { tabId: tab.id } })}
            className={`group flex items-center gap-1.5 px-3 h-full cursor-pointer border-r border-[#2d2e32] transition-colors min-w-0 max-w-[180px] ${
              isActive
                ? 'bg-[#1a1b1e] text-[#e1e1e3] border-t-2 border-t-[#6c8cff]'
                : 'text-[#6a6e78] hover:text-[#a0a4ab] hover:bg-[#232428] border-t-2 border-t-transparent'
            }`}
          >
            {/* Иконка файла */}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 opacity-50">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>

            {/* Имя файла */}
            <span className="text-[12px] truncate">{tab.fileName}</span>

            {/* Индикатор несохранённых изменений */}
            {tab.isModified && (
              <span className="w-2 h-2 rounded-full bg-[#6c8cff] flex-shrink-0" />
            )}

            {/* Кнопка закрытия */}
            <button
              onClick={(e) => {
                e.stopPropagation() // Не переключаем вкладку при закрытии
                dispatch({ type: 'CLOSE_TAB', payload: { tabId: tab.id } })
              }}
              className="ml-auto p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[#3a3d44] transition-all flex-shrink-0"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="2" y1="2" x2="8" y2="8" />
                <line x1="8" y1="2" x2="2" y2="8" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
