/**
 * TitleBar.tsx — Кастомная шапка окна (frameless window).
 * Содержит логотип, MenuBar, переключатель режимов и кнопки управления окном.
 */
import { useState, useEffect, useCallback } from 'react'
import { MenuBar } from './MenuBar'
import { SettingsPopup } from './SettingsPopup'
import { AuthModal } from './AuthModal'
import { PublishModal } from './PublishModal'
import { CollaborationModal } from './CollaborationModal'
import { RawModeWarningModal, STORAGE_KEY_HIDE_RAW_WARNING } from './RawModeWarningModal'
import { useEditor } from '../context/EditorContext'
import { useAuth } from '../context/AuthContext'
import { articlesApi, collaborationApi } from '../api'
import { Users, Lightbulb, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
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
  const [showCollab, setShowCollab] = useState(false)
  const [showRawWarning, setShowRawWarning] = useState(false)
  const { state, dispatch, setEditorMode, toggleSidebar } = useEditor()
  const { user, logout } = useAuth()
  const [modeLoading, setModeLoading] = useState(false)

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId)
  const articleId = activeTab?.articleId ?? null
  const isOnlineArticle = !!articleId

  const [userRole, setUserRole] = useState<'author' | 'co_author' | 'editor' | null>(null)
  const suggestionModeActive = activeTab?.suggestionMode ?? false
  const isSuggestionActive = userRole === 'editor' || suggestionModeActive

  useEffect(() => {
    if (!articleId || !user) {
      setUserRole(null)
      return
    }
    articlesApi.get(articleId).then((art) => {
      if (art.author_id === user.id) {
        setUserRole('author')
      } else {
        collaborationApi.list(articleId)
          .then(list => {
            const me = list.find((c) => c.user_id === user.id)
            setUserRole((me?.role as any) ?? null)
          })
          .catch(() => setUserRole(null))
      }
    }).catch(() => setUserRole(null))
  }, [articleId, user])

  // Слушаем событие от MarkdownEditor, что редактор готов
  useEffect(() => {
    const handler = () => setModeLoading(false)
    window.addEventListener('editor-mode-ready', handler)
    return () => window.removeEventListener('editor-mode-ready', handler)
  }, [])

  const changeModeWithSpinner = useCallback((targetMode: EditorMode) => {
    setModeLoading(true)
    setTimeout(() => setEditorMode(targetMode), 50)
  }, [setEditorMode])

  const handleModeClick = useCallback(async (targetMode: EditorMode) => {
    if (state.editorMode === targetMode) return
    if (targetMode === 'raw' && isOnlineArticle) {
      let hideWarning = false
      try {
        hideWarning = !!(await window.api.storeGet(STORAGE_KEY_HIDE_RAW_WARNING))
      } catch {
        hideWarning = localStorage.getItem(STORAGE_KEY_HIDE_RAW_WARNING) === 'true'
      }
      if (!hideWarning) {
        setShowRawWarning(true)
        return
      }
    }
    changeModeWithSpinner(targetMode)
  }, [state.editorMode, isOnlineArticle, changeModeWithSpinner])

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
            paddingLeft: '6px',
            paddingRight: '12px',
          } as React.CSSProperties}
        >
          {/* Кнопка сворачивания/разворачивания сайдбара */}
          <button
            onClick={toggleSidebar}
            className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] transition-colors shrink-0"
            style={{
              WebkitAppRegion: 'no-drag',
              marginRight: '6px',
            } as React.CSSProperties}
            title={state.sidebarOpen ? "Свернуть боковую панель (Ctrl+Shift+B)" : "Развернуть боковую панель (Ctrl+Shift+B)"}
          >
            {state.sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>

          {/* Интерактивное Меню */}
          <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <MenuBar />
          </div>
        </div>

        {/* Центральная часть — переключатель режимов (скрыт в режиме советчика) */}
        <div
          className="flex-1 flex items-center justify-center h-full"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          {!isSuggestionActive && (
            <div
              className="flex items-center rounded-md overflow-hidden border border-[var(--border-default)]"
              style={{ WebkitAppRegion: 'no-drag', height: '22px' } as React.CSSProperties}
            >
              {modes.map((m) => (
                <button
                  key={m.key}
                  onClick={() => handleModeClick(m.key)}
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
          )}
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

          {/* Кнопка "Совместная работа" (для автора онлайн-статьи) */}
          {articleId && userRole === 'author' && (
            <button
              onClick={() => setShowCollab(true)}
              className="w-9 h-full flex items-center justify-center text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] transition-colors"
              title="Совместная работа (соавторы и редакторы)"
            >
              <Users size={15} />
            </button>
          )}

          {/* Переключатель режима советчика (доступен только в режиме seamless) */}
          {state.editorMode === 'seamless' && articleId && (userRole === 'author' || userRole === 'co_author') && activeTab && (
            <button
              onClick={() => dispatch({ type: 'SET_SUGGESTION_MODE', payload: { tabId: activeTab.id, active: !activeTab.suggestionMode } })}
              className={`w-9 h-full flex items-center justify-center transition-colors ${activeTab.suggestionMode ? 'text-amber-500 bg-amber-500/10' : 'text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]'}`}
              title={activeTab.suggestionMode ? "Выключить режим советчика" : "Включить режим советчика"}
            >
              <Lightbulb size={15} />
            </button>
          )}

          {/* Индикатор роли для редактора (только в режиме seamless) */}
          {state.editorMode === 'seamless' && articleId && userRole === 'editor' && (
            <span className="titlebar-badge" title="Вы редактор этой статьи (режим советчика)">Советчик</span>
          )}

          {/* Кнопка "Публикация / Поделиться" (для автора или новой статьи) */}
          {user && (!articleId || userRole === 'author') && (
            <button
              onClick={() => setShowPublish(true)}
              className="w-9 h-full flex items-center justify-center transition-colors"
              style={{
                color: isOnlineArticle ? 'var(--accent)' : 'var(--text-dim)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = isOnlineArticle
                  ? 'var(--accent)'
                  : 'var(--text-secondary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = isOnlineArticle
                  ? 'var(--accent)'
                  : 'var(--text-dim)'
              }}
              title="Настройки публикации на type-club.ru"
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
      {showCollab && articleId && <CollaborationModal articleId={articleId} onClose={() => setShowCollab(false)} />}
      {showRawWarning && (
        <RawModeWarningModal
          onConfirm={() => {
            setShowRawWarning(false)
            changeModeWithSpinner('raw')
          }}
          onCancel={() => setShowRawWarning(false)}
        />
      )}
    </>
  )
}
