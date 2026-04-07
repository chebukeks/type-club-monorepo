/**
 * TitleBar.tsx — Кастомная шапка окна (frameless window).
 * Содержит логотип, MenuBar, кнопки настроек/пользователя и кнопки управления окном.
 */
import { useState } from 'react'
import { MenuBar } from './MenuBar'
import { SettingsPopup } from './SettingsPopup'

export function TitleBar() {
  const [showSettings, setShowSettings] = useState(false)

  return (
    <div
      className="flex items-center h-9 bg-[var(--bg-surface)] border-b border-[var(--border-default)] select-none"
      style={{ paddingLeft: '8px', paddingRight: '0' }}
    >
      {/* Область перетаскивания окна */}
      <div
        className="flex-1 flex items-center h-full"
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
          <img
            src="/icon.svg"
            alt="Logo"
            width="16"
            height="16"
            className="block opacity-80"
          />
        </div>

        {/* Интерактивное Меню */}
        <MenuBar />
      </div>

      {/* Кнопки: пользователь + настройки + управление окном */}
      <div
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Иконка пользователя (заглушка) */}
        <button
          onClick={() => {/* заглушка — пока ничего не делает */ }}
          className="w-9 h-full flex items-center justify-center text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] transition-colors"
          title="Аккаунт"
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
  )
}

