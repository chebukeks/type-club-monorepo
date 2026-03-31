/**
 * TitleBar.tsx — Кастомная шапка окна (frameless window).
 * Содержит логотип, MenuBar и кнопки управления окном.
 */
import { MenuBar } from './MenuBar'

export function TitleBar() {
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
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--accent)]"
          >
            <path d="M4 7V4h16v3" />
            <path d="M9 20h6" />
            <path d="M12 4v16" />
          </svg>
        </div>

        {/* Интерактивное Меню */}
        <MenuBar />
      </div>

      {/* Кнопки управления окном */}
      <div
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
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
