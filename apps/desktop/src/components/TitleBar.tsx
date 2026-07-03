/**
 * TitleBar.tsx — Кастомная шапка окна (frameless window).
 * Содержит логотип, MenuBar, переключатель режимов и кнопки управления окном.
 */
import { useState, useEffect } from 'react'
import { MenuBar } from './MenuBar'
import { SettingsPopup } from './SettingsPopup'
import { AuthModal } from './AuthModal'
import { PublishModal } from './PublishModal'
import { useEditor } from '../context/EditorContext'
import { useAuth } from '../context/AuthContext'
import type { EditorMode } from '../types'

const modes: { key: EditorMode; label: string }[] = [
  { key: 'raw', label: 'Raw' },
  { key: 'seamless', label: 'Seamless' },
  { key: 'preview', label: 'Preview' },
]

export function TitleBar() {
  const [showSettings, setShowSettings] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [showPublish, setShowPublish] = useState(false)
  const { state, setEditorMode } = useEditor()
  const { user, logout } = useAuth()
  const [modeLoading, setModeLoading] = useState(false)

  // Слушаем событие от MarkdownEditor, что редактор готов
  useEffect(() => {
    const handler = () => setModeLoading(false)
    window.addEventListener('editor-mode-ready', handler)
    return () => window.removeEventListener('editor-mode-ready', handler)
  }, [])

  return (
    <>
      <div
        className="flex items-center h-9 bg-[var(--bg-surface)] border-b border-[var(--border-default)] select-none"
        style={{ paddingLeft: '8px', paddingRight: '0' }}
      >
        {/* Область перетаскивания окна — левая часть */}
        <div
          className="flex items-center h-full"
          style={{
            WebkitAppRegion: 'drag',
            paddingLeft: '12px',
            paddingRight: '12px',
          } as React.CSSProperties}
        >
          {/* Логотип */}
          <div
            className="flex items-center gap-2 text-[var(--text-muted)] text-xs font-medium tracking-wide"
            style={{ marginRight: '12px' }}
          >
            <svg width="16" height="16" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" className="block opacity-80">
              <path fill="#637be5" d="m512,32c-164.69,0-309.99,82.96-396.44,209.35h506.04v168.49h-229.66v238.43c7.94-22.8,18.86-44.76,32.85-65.86,29.77-44.92,70.94-81.63,123.54-110.16,45.89-24.89,91.65-39.18,137.28-42.91,45.63-3.71,88.93,3.13,129.9,20.49l-46.01,130.76c-53.77-21.56-103.85-19.78-150.21,5.37-27.25,14.78-48.27,33.93-63.06,57.41-14.79,23.49-22.15,49.29-22.06,77.39.08,28.11,7.78,56.26,23.08,84.46,15.3,28.21,34.7,50.01,58.21,65.4,23.51,15.41,49.14,23.32,76.9,23.72,27.75.42,55.26-6.77,82.51-21.55,46.37-25.15,75.18-66.14,86.43-122.98l59.16,14.38c45.35-73.29,71.55-159.68,71.55-252.2,0-265.1-214.9-480-480-480ZM32,512c0,136,56.57,258.77,147.45,346.11v-448.27H42.93c-7.14,32.93-10.93,67.1-10.93,102.16Zm381.82,371.01c-8.88-16.37-16.15-32.87-21.88-49.5v143.35c38.37,9.88,78.6,15.14,120.06,15.14.17,0,.34,0,.52,0-40.65-26.32-73.56-62.64-98.69-108.98Z"/>
            </svg>
          </div>

          {/* Интерактивное Меню */}
          <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <MenuBar />
          </div>
        </div>

        {/* Центральная часть — переключатель режимов */}
        <div
          className="flex-1 flex items-center justify-center h-full"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div
            className="flex items-center rounded-md overflow-hidden border border-[var(--border-default)]"
            style={{ WebkitAppRegion: 'no-drag', height: '22px' } as React.CSSProperties}
          >
            {modes.map((m) => (
              <button
                key={m.key}
                onClick={() => {
                  if (state.editorMode !== m.key) {
                    setModeLoading(true)
                    // Даём браузеру кадр на отрисовку спиннера,
                    // прежде чем начать тяжёлую синхронную работу
                    // (сериализация 32 МБ + рендер textarea)
                    setTimeout(() => setEditorMode(m.key), 50)
                  }
                }}
                className="transition-colors text-[11px] font-medium tracking-wide"
                style={{
                  padding: '0 10px',
                  height: '100%',
                  backgroundColor: state.editorMode === m.key ? 'var(--accent)' : 'transparent',
                  color: state.editorMode === m.key ? 'white' : 'var(--text-dim)',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
          {/* Спиннер при переключении режима */}
          {modeLoading && (
            <div
              className="ml-2 flex items-center"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
                <circle cx="12" cy="12" r="10" stroke="var(--text-dim)" strokeWidth="2" opacity="0.3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          )}
        </div>

        {/* Кнопки: пользователь + настройки + управление окном */}
        <div
          className="flex items-center h-full"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {/* Кнопка поиска (Ctrl+F) */}
          <button
            onClick={() => window.dispatchEvent(new Event('editor-open-search'))}
            className="w-9 h-full flex items-center justify-center text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] transition-colors"
            title="Поиск (Ctrl+F)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          {/* Кнопка "Поделиться" (только когда залогинен) */}
          {user && (
            <button
              onClick={() => setShowPublish(true)}
              className="w-9 h-full flex items-center justify-center text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] transition-colors"
              title="Поделиться на type-club.ru"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </button>
          )}

          {/* Иконка пользователя */}
          <button
            onClick={() => {
              if (user) {
                logout()
              } else {
                setShowAuth(true)
              }
            }}
            className="w-9 h-full flex items-center justify-center transition-colors"
            style={{
              color: user ? 'var(--accent)' : 'var(--text-dim)',
            }}
            onMouseEnter={(e) => {
              if (user) e.currentTarget.style.color = '#e81123'
            }}
            onMouseLeave={(e) => {
              if (user) e.currentTarget.style.color = 'var(--accent)'
            }}
            title={user ? `Выйти (${user.nickname})` : 'Аккаунт'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>

          {/* Настройки */}
          <div className="relative h-full">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`w-9 h-full flex items-center justify-center transition-colors ${showSettings
                  ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                  : 'text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]'
                }`}
              title="Настройки"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            {showSettings && <SettingsPopup onClose={() => setShowSettings(false)} />}
          </div>

          {/* Разделитель */}
          <div className="w-px h-4 bg-[var(--border-default)] mx-0.5" />

          {/* Кнопки управления окном */}
          <button
            onClick={() => window.api.minimizeWindow()}
            className="w-11 h-full flex items-center justify-center text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <svg width="10" height="1" viewBox="0 0 10 1">
              <rect width="10" height="1" fill="currentColor" />
            </svg>
          </button>
          <button
            onClick={() => window.api.maximizeWindow()}
            className="w-11 h-full flex items-center justify-center text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="0.5" y="0.5" width="9" height="9" />
            </svg>
          </button>
          <button
            onClick={() => window.api.closeWindow()}
            className="w-11 h-full flex items-center justify-center text-[var(--text-dim)] hover:bg-[var(--close-hover-bg)] hover:text-white transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
              <line x1="1" y1="1" x2="9" y2="9" />
              <line x1="9" y1="1" x2="1" y2="9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Модальные окна */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showPublish && <PublishModal onClose={() => setShowPublish(false)} />}
    </>
  )
}
