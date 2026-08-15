import { useState, useEffect, useRef, useCallback } from 'react'
import { MenuBar } from './MenuBar'
import { SettingsPopup } from './SettingsPopup'
import { SettingsModal } from './SettingsModal'
import { AuthModal } from './AuthModal'
import { PublishModal } from './PublishModal'
import { CollaborationModal } from './CollaborationModal'
import { RawModeWarningModal, STORAGE_KEY_HIDE_RAW_WARNING } from './RawModeWarningModal'
import { useEditor } from '../context/EditorContext'
import { useAuth } from '../context/AuthContext'
import { articlesApi, collaborationApi } from '../api'
import { config } from '../config'
import { Users, Lightbulb, PanelLeftClose, PanelLeftOpen, PanelTopClose, PanelTopOpen } from 'lucide-react'
import type { EditorMode } from '../types'

const modes: { key: EditorMode; label: string }[] = [
  { key: 'seamless', label: 'Seamless' },
  { key: 'raw', label: 'Raw' },
  { key: 'preview', label: 'Preview' },
]

function ProfileMenuPopup({ user, logout, onClose }: { user: { nickname: string; id: number }; logout: () => void; onClose: () => void }) {
  const { t } = useEditor()
  const popupRef = useRef<HTMLDivElement>(null)
  const [closing, setClosing] = useState(false)

  const handleClose = () => {
    setClosing(true)
    setTimeout(onClose, 100)
  }

  // Закрытие при клике вне
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        handleClose()
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])

  return (
    <div
      ref={popupRef}
      className={`absolute right-0 top-full mt-1 w-52 py-1 bg-[var(--bg-elevated)] backdrop-blur-xl border border-[var(--border-strong)] rounded-xl shadow-2xl z-50 flex flex-col text-[13px] text-[var(--text-secondary)] ${
        closing
          ? 'animate-out fade-out zoom-out-95 duration-100 ease-in fill-mode-forwards'
          : 'animate-in fade-in zoom-in-95 duration-100 ease-out'
      }`}
    >
      <button
        className="menu-item enabled flex items-center justify-between"
        onClick={() => {
          handleClose()
          window.api.openExternal(`${config.siteUrl}/${user.nickname}`)
        }}
      >
        <span className="font-medium text-[var(--text-primary)] truncate">{user.nickname}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-dim)] shrink-0 ml-2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </button>

      <button
        className="menu-item enabled flex items-center justify-between"
        onClick={() => {
          onClose()
          window.api.openExternal(`${config.siteUrl}/settings`)
        }}
      >
        <span>{t('settings.profileSettings')}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-dim)] shrink-0 ml-2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </button>

      <div className="border-t border-[var(--border-default)] my-1.5 mx-2 opacity-80" />

      <button
        className="menu-item enabled"
        style={{ color: 'var(--text-danger)' }}
        onClick={() => {
          onClose()
          logout()
        }}
      >
        {t('auth.logout')}
      </button>
    </div>
  )
}

export function TitleBar() {
  const [showSettings, setShowSettings] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [showPublish, setShowPublish] = useState(false)
  const [showCollab, setShowCollab] = useState(false)
  const [showRawWarning, setShowRawWarning] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const { state, dispatch, setEditorMode, toggleSidebar, toggleTabBar, t } = useEditor()
  const { user, logout } = useAuth()
  const [modeLoading, setModeLoading] = useState(false)

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId)
  const articleId = activeTab?.articleId ?? null
  const isOnlineArticle = !!articleId

  const [rolesMap, setRolesMap] = useState<Record<number, 'author' | 'co_author' | 'editor' | null>>({})
  const userRole = articleId ? (rolesMap[articleId] ?? null) : null
  const suggestionModeActive = articleId != null && (activeTab?.suggestionMode ?? false)
  const isSuggestionActive = articleId != null && (userRole === 'editor' || suggestionModeActive)

  useEffect(() => {
    if (!articleId || !user || rolesMap[articleId] !== undefined) {
      return
    }
    let isCurrent = true
    articlesApi.get(articleId).then((art) => {
      if (!isCurrent) return
      if (art.author_id === user.id) {
        setRolesMap((prev) => ({ ...prev, [articleId]: 'author' }))
      } else {
        collaborationApi.list(articleId)
          .then(list => {
            if (!isCurrent) return
            const me = list.find((c) => c.user_id === user.id)
            const role = (me?.role as any) ?? null
            setRolesMap((prev) => ({ ...prev, [articleId]: role }))
          })
          .catch(() => { if (isCurrent) setRolesMap((prev) => ({ ...prev, [articleId]: null })) })
      }
    }).catch(() => { if (isCurrent) setRolesMap((prev) => ({ ...prev, [articleId]: null })) })

    return () => {
      isCurrent = false
    }
  }, [articleId, user, rolesMap])

  // Слушаем событие от MarkdownEditor, что редактор готов
  useEffect(() => {
    const handler = () => setModeLoading(false)
    window.addEventListener('editor-mode-ready', handler)
    return () => window.removeEventListener('editor-mode-ready', handler)
  }, [])

  // Слушаем глобальное событие открытия настроек
  useEffect(() => {
    const handler = () => setShowSettingsModal(true)
    window.addEventListener('open-settings', handler)
    return () => window.removeEventListener('open-settings', handler)
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
        className="flex items-center h-9 bg-[var(--bg-surface)] select-none"
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
              marginRight: '4px',
            } as React.CSSProperties}
            title={state.sidebarOpen ? t('titlebar.collapseSidebar') : t('titlebar.expandSidebar')}
          >
            {state.sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>

          {/* Кнопка скрытия/показа панели вкладок */}
          <button
            onClick={toggleTabBar}
            className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] transition-colors shrink-0"
            style={{
              WebkitAppRegion: 'no-drag',
              marginRight: '6px',
            } as React.CSSProperties}
            title={state.tabBarOpen ? t('titlebar.collapseTabBar') : t('titlebar.expandTabBar')}
          >
            {state.tabBarOpen ? <PanelTopClose size={16} /> : <PanelTopOpen size={16} />}
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
              className="flex items-center rounded-lg bg-[var(--bg-surface)] select-none"
              style={{ padding: '3px', gap: '3px', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              {modes.map((m) => (
                <button
                  key={m.key}
                  onClick={() => handleModeClick(m.key)}
                  className={`text-[12px] font-medium rounded-md transition-all border ${
                    state.editorMode === m.key
                      ? 'bg-[var(--bg-base)] text-[var(--text-primary)] shadow-xs border-[var(--border-default)] font-medium'
                      : 'text-[var(--text-dim)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border-transparent'
                  }`}
                  style={{ padding: '3px 10px' }}
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
            title={t('titlebar.search')}
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
              title={t('titlebar.collaboration')}
            >
              <Users size={15} />
            </button>
          )}

          {/* Переключатель режима советчика (доступен только в режиме seamless) */}
          {state.editorMode === 'seamless' && articleId && (userRole === 'author' || userRole === 'co_author') && activeTab && (
            <button
              onClick={() => dispatch({ type: 'SET_SUGGESTION_MODE', payload: { tabId: activeTab.id, active: !activeTab.suggestionMode } })}
              className={`w-9 h-full flex items-center justify-center transition-colors ${activeTab.suggestionMode ? 'text-amber-500 bg-amber-500/10' : 'text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]'}`}
              title={activeTab.suggestionMode ? t('titlebar.turnOffSuggestion') : t('titlebar.turnOnSuggestion')}
            >
              <Lightbulb size={15} />
            </button>
          )}

          {/* Индикатор роли для редактора (только в режиме seamless) */}
          {state.editorMode === 'seamless' && articleId && userRole === 'editor' && (
            <span className="titlebar-badge" title={t('titlebar.advisorBadgeTitle')}>{t('titlebar.advisorBadge')}</span>
          )}

          {/* Кнопка "Публикация / Поделиться" (для автора или новой статьи) */}
          {user && (!articleId || userRole === 'author') && (
            <button
              onClick={() => setShowPublish(true)}
              className={`w-9 h-full flex items-center justify-center transition-colors ${
                isOnlineArticle
                  ? 'text-[var(--accent)] hover:bg-[var(--bg-hover)]'
                  : 'text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]'
              }`}
              title={t('titlebar.publishSettings')}
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

          {/* Иконка пользователя / Меню профиля */}
          <div className="relative h-full">
            <button
              onClick={() => {
                if (user) {
                  setShowProfileMenu(!showProfileMenu)
                } else {
                  setShowAuth(true)
                }
              }}
              className={`w-9 h-full flex items-center justify-center transition-colors ${
                showProfileMenu
                  ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                  : user
                  ? 'text-[var(--accent)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent)]'
                  : 'text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]'
              }`}
              title={user ? `${t('titlebar.profile')} (${user.nickname})` : t('titlebar.account')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
            {showProfileMenu && user && (
              <ProfileMenuPopup user={user} logout={logout} onClose={() => setShowProfileMenu(false)} />
            )}
          </div>

          {/* Настройки */}
          <div className="relative h-full">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`w-9 h-full flex items-center justify-center transition-colors ${showSettings
                  ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                  : 'text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]'
                }`}
              title={t('titlebar.settings')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            {showSettings && (
              <SettingsPopup
                onClose={() => setShowSettings(false)}
                onOpenSettingsModal={() => {
                  setShowSettings(false)
                  setShowSettingsModal(true)
                }}
              />
            )}
          </div>



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
      {showSettingsModal && <SettingsModal onClose={() => setShowSettingsModal(false)} />}
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
