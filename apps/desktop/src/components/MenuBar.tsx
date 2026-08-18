import { useState, useRef, useEffect } from 'react'
import { ChevronRight } from 'lucide-react'
import { useEditor } from '../context/EditorContext'
import { generateExportHtml, Locale } from '@type-club/editor'
import type { Tab, ThemeMode, FocusMode } from '../types'

function RadioIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" className={active ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'} />
      {active && <circle cx="7" cy="7" r="3" fill="currentColor" className="text-[var(--accent)]" />}
    </svg>
  )
}

function AnimatedMenu({
  isOpen,
  children,
  className = '',
  style,
  onMouseEnter,
  onMouseLeave,
  isSubmenu = false
}: {
  isOpen: boolean
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  isSubmenu?: boolean
}) {
  const [mounted, setMounted] = useState(isOpen)

  useEffect(() => {
    if (isOpen) {
      setMounted(true)
    } else {
      if (isSubmenu) {
        setMounted(false)
      } else {
        const timer = setTimeout(() => setMounted(false), 100)
        return () => clearTimeout(timer)
      }
    }
  }, [isOpen, isSubmenu])

  if (!mounted) return null

  return (
    <div
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`${className} ${
        isOpen
          ? 'animate-in fade-in zoom-in-95 duration-100 ease-out'
          : isSubmenu
            ? ''
            : 'animate-out fade-out zoom-out-95 duration-100 ease-in fill-mode-forwards'
      }`}
    >
      {children}
    </div>
  )
}

export function MenuBar() {
  const {
    state, dispatch,
    saveActiveFile, openFolder, openFile,
    openFileViaDialog, saveActiveFileAs,
    startCreating, startRenaming,
    setTheme, setLanguage, t, refreshTab, setFocusMode,
    getRecentFiles, getRecentFolders, clearRecentFiles, clearRecentFolders,
    removeRecentFile, removeRecentFolder,
    toggleSidebar, toggleTabBar, setTocLayoutMode, setStatsLayoutMode,
  } = useEditor()
  const { activeTabId, tabs, folderPath, theme, language, focusMode } = state
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [submenu, setSubmenu] = useState<string | null>(null)
  const [recentFiles, setRecentFiles] = useState<string[]>([])
  const [recentFolders, setRecentFolders] = useState<string[]>([])
  const menuRef = useRef<HTMLDivElement>(null)

  const activeTab = activeTabId ? tabs.find((t: Tab) => t.id === activeTabId) : null

  // Закрытие меню при клике вне
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenu(null)
        setSubmenu(null)
      }
    }
    if (openMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenu])

  // Глобальные горячие клавиши
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      const shift = e.shiftKey
      const code = e.code // физическая клавиша — не зависит от раскладки

      if (ctrl && !shift && code === 'KeyS') { e.preventDefault(); saveActiveFile() }
      else if (ctrl && shift && code === 'KeyS') { e.preventDefault(); saveActiveFileAs() }
      else if (ctrl && !shift && code === 'KeyO') { e.preventDefault(); openFileViaDialog() }
      else if (ctrl && shift && code === 'KeyO') { e.preventDefault(); openFolder() }
      else if (ctrl && shift && code === 'KeyB') { e.preventDefault(); toggleSidebar() }
      else if (ctrl && !shift && code === 'KeyN') {
        e.preventDefault()
        if (folderPath) startCreating('file')
      }
      else if (ctrl && shift && code === 'KeyN') {
        e.preventDefault()
        if (folderPath) startCreating('folder')
      }
      else if (e.code === 'F5') {
        e.preventDefault()
        if (activeTabId) refreshTab(activeTabId)
      }
      else if (e.code === 'F2') {
        if (activeTab) {
          e.preventDefault()
          startRenaming(activeTab.filePath, 'file')
        }
      }
      // Ctrl+Tab / Ctrl+Shift+Tab — переключение между вкладками
      else if (ctrl && e.key === 'Tab') {
        e.preventDefault()
        const { tabs } = state
        if (tabs.length < 2) return
        const currentIndex = tabs.findIndex(t => t.id === activeTabId)
        if (currentIndex === -1) return
        const nextIndex = shift
          ? (currentIndex - 1 + tabs.length) % tabs.length
          : (currentIndex + 1) % tabs.length
        dispatch({ type: 'SET_ACTIVE_TAB', payload: { tabId: tabs[nextIndex].id } })
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [saveActiveFile, saveActiveFileAs, openFileViaDialog, openFolder, folderPath, dispatch, activeTabId, activeTab, refreshTab, startRenaming, startCreating, state])

  const closeMenu = () => { setOpenMenu(null); setSubmenu(null) }
  const toggleMenu = (name: string) => {
    if (openMenu === name) closeMenu()
    else { setOpenMenu(name); setSubmenu(null) }
  }

  // Обработчики File
  const resolveTheme = (): 'dark' | 'light' => {
    if (state.theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return state.theme as 'dark' | 'light'
  }
  const handleExportHtml = async () => {
    closeMenu()
    if (!activeTab) return
    const html = generateExportHtml(activeTab.content, resolveTheme())
    await window.api.exportHtml(html, activeTab.fileName.replace(/\.md$/i, '.html'))
  }
  const handleExportPdf = async () => {
    closeMenu()
    if (!activeTab) return
    const html = generateExportHtml(activeTab.content, resolveTheme())
    await window.api.exportPdf(html, activeTab.fileName.replace(/\.md$/i, '.pdf'))
  }
  const handleCreateFile = () => { closeMenu(); if (folderPath) startCreating('file') }
  const handleCreateFolder = () => { closeMenu(); if (folderPath) startCreating('folder') }
  const handleOpenFile = () => { closeMenu(); openFileViaDialog() }
  const handleOpenFolder = () => { closeMenu(); openFolder() }
  const handleSave = () => { closeMenu(); saveActiveFile() }
  const handleSaveAs = () => { closeMenu(); saveActiveFileAs() }

  // Обработчики View
  const handleRefresh = () => { closeMenu(); if (activeTabId) refreshTab(activeTabId) }
  const handleSetTheme = (tMode: ThemeMode) => { closeMenu(); setTheme(tMode) }
  const handleSetLanguage = (lang: Locale) => { closeMenu(); setLanguage(lang) }
  const handleSetFocusMode = (m: FocusMode) => { closeMenu(); setFocusMode(m) }

  // Недавние файлы/папки — ленивая загрузка с автоочисткой несуществующих путей
  const loadRecent = async () => {
    const [files, folders] = await Promise.all([
      getRecentFiles(),
      getRecentFolders(),
    ])
    const validFiles = await filterExisting(files)
    const validFolders = await filterExisting(folders)
    setRecentFiles(validFiles)
    setRecentFolders(validFolders)
  }
  const filterExisting = async (paths: string[]): Promise<string[]> => {
    const results = await Promise.all(paths.map(async (p) => {
      try { return await window.api.exists(p) ? p : null } catch { return p }
    }))
    return results.filter((p): p is string => p !== null)
  }
  const handleOpenRecent = (filePath: string) => {
    closeMenu()
    const name = filePath.replace(/^.*[\\/]/, '') || 'untitled.md'
    openFile(filePath, name)
  }
  const handleOpenRecentFolder = async (fPath: string) => {
    closeMenu()
    try {
      const fileTree = await window.api.readDir(fPath)
      dispatch({ type: 'SET_FILE_TREE', payload: { folderPath: fPath, fileTree } })
      await window.api.storeSet('lastFolderPath', fPath)
    } catch (err) { /* ignore */ }
  }

  const itemCls = (enabled: boolean) => `menu-item ${enabled ? 'enabled' : 'disabled'}`

  const sep = <div className="border-t border-[var(--border-default)] my-1.5 mx-2 opacity-80" />

  const menuBtnCls = (name: string) =>
    `rounded transition-colors ${openMenu === name ? 'bg-[var(--bg-active)] text-white' : 'hover:bg-[var(--bg-active)]'}`

  return (
    <div
      className="flex items-center text-[13px] text-[var(--text-secondary)] select-none"
      style={{ WebkitAppRegion: 'no-drag', marginLeft: '0px' } as React.CSSProperties}
      ref={menuRef}
    >
      {/* === FILE === */}
      <div className="relative">
        <button onClick={() => toggleMenu('file')} className={menuBtnCls('file')} style={{ padding: '2px 12px' }}>{t('menu.file')}</button>
        <AnimatedMenu isOpen={openMenu === 'file'} className="absolute top-full left-0 mt-1 min-w-[240px] w-max py-1 bg-[var(--bg-elevated)] backdrop-blur-xl border border-[var(--border-strong)] rounded-xl shadow-2xl z-50">
          <div className={itemCls(!!folderPath)} onClick={folderPath ? handleCreateFile : undefined}>
            <span>{t('menu.file.newFile')}</span><span className="text-[11px] text-[var(--text-dim)]">Ctrl+N</span>
          </div>
          <div className={itemCls(!!folderPath)} onClick={folderPath ? handleCreateFolder : undefined}>
            <span>{t('menu.file.newFolder')}</span><span className="text-[11px] text-[var(--text-dim)]">Ctrl+Shift+N</span>
          </div>
          {sep}
          <div className={itemCls(true)} onClick={handleOpenFile}>
            <span>{t('menu.file.openFile')}</span><span className="text-[11px] text-[var(--text-dim)]">Ctrl+O</span>
          </div>
          <div className={itemCls(true)} onClick={handleOpenFolder}>
            <span>{t('menu.file.openFolder')}</span><span className="text-[11px] text-[var(--text-dim)]">Ctrl+Shift+O</span>
          </div>
          {sep}
          {/* Недавние файлы */}
          <div
            className="menu-item enabled relative"
            onMouseEnter={() => { setSubmenu('recentFiles'); loadRecent() }}
            onMouseLeave={() => setSubmenu(null)}
          >
            <span>{t('menu.file.recentFiles')}</span>
            <ChevronRight size={14} className="text-[var(--text-dim)]" />
            <AnimatedMenu
              isOpen={submenu === 'recentFiles'}
              isSubmenu
              onMouseEnter={() => setSubmenu('recentFiles')}
              onMouseLeave={() => setSubmenu(null)}
              className="absolute left-full top-0 ml-0.5 w-72 py-1 bg-[var(--bg-elevated)] backdrop-blur-xl border border-[var(--border-strong)] rounded-xl shadow-2xl z-50"
            >
              {recentFiles.length === 0 ? (
                <div className="px-4 py-2 text-[12px] text-[var(--text-dim)] italic">{t('menu.file.empty')}</div>
              ) : (
                <>
                  {recentFiles.map((fp) => (
                    <div key={fp} className={`${itemCls(true)} group`}>
                      <span className="truncate text-[12px] flex-1" onClick={() => handleOpenRecent(fp)}>{fp.replace(/^.*[\\/]/, '')}</span>
                      <span className="text-[10px] text-[var(--text-dim)] truncate ml-auto mr-1" style={{ maxWidth: '140px' }} onClick={() => handleOpenRecent(fp)}>{fp}</span>
                      <button
                        className="opacity-0 group-hover:opacity-100 text-[var(--text-dim)] hover:text-[var(--text-danger)] px-1 text-[14px] leading-none flex-shrink-0"
                        onClick={(e) => { e.stopPropagation(); removeRecentFile(fp); setRecentFiles(prev => prev.filter(f => f !== fp)) }}
                      >×</button>
                    </div>
                  ))}
                  {sep}
                  <div className={itemCls(true)} onClick={() => { clearRecentFiles(); setRecentFiles([]) }}>
                    <span className="text-[var(--text-dim)]">{t('menu.file.clear')}</span>
                  </div>
                </>
              )}
            </AnimatedMenu>
          </div>
          {/* Недавние папки */}
          <div
            className="menu-item enabled relative"
            onMouseEnter={() => { setSubmenu('recentFolders'); loadRecent() }}
            onMouseLeave={() => setSubmenu(null)}
          >
            <span>{t('menu.file.recentFolders')}</span>
            <ChevronRight size={14} className="text-[var(--text-dim)]" />
            <AnimatedMenu
              isOpen={submenu === 'recentFolders'}
              isSubmenu
              onMouseEnter={() => setSubmenu('recentFolders')}
              onMouseLeave={() => setSubmenu(null)}
              className="absolute left-full top-0 ml-0.5 w-72 py-1 bg-[var(--bg-elevated)] backdrop-blur-xl border border-[var(--border-strong)] rounded-xl shadow-2xl z-50"
            >
              {recentFolders.length === 0 ? (
                <div className="px-4 py-2 text-[12px] text-[var(--text-dim)] italic">{t('menu.file.empty')}</div>
              ) : (
                <>
                  {recentFolders.map((fp) => (
                    <div key={fp} className={`${itemCls(true)} group`}>
                      <span className="truncate text-[12px] flex-1" onClick={() => handleOpenRecentFolder(fp)}>{fp.replace(/^.*[\\/]/, '')}</span>
                      <span className="text-[10px] text-[var(--text-dim)] truncate ml-auto mr-1" style={{ maxWidth: '140px' }} onClick={() => handleOpenRecentFolder(fp)}>{fp}</span>
                      <button
                        className="opacity-0 group-hover:opacity-100 text-[var(--text-dim)] hover:text-[var(--text-danger)] px-1 text-[14px] leading-none flex-shrink-0"
                        onClick={(e) => { e.stopPropagation(); removeRecentFolder(fp); setRecentFolders(prev => prev.filter(f => f !== fp)) }}
                      >×</button>
                    </div>
                  ))}
                  {sep}
                  <div className={itemCls(true)} onClick={() => { clearRecentFolders(); setRecentFolders([]) }}>
                    <span className="text-[var(--text-dim)]">{t('menu.file.clear')}</span>
                  </div>
                </>
              )}
            </AnimatedMenu>
          </div>
          {sep}
          <div className={itemCls(!!activeTabId)} onClick={activeTabId ? handleSave : undefined}>
            <span>{t('menu.file.save')}</span><span className="text-[11px] text-[var(--text-dim)]">Ctrl+S</span>
          </div>
          <div className={itemCls(!!activeTabId)} onClick={activeTabId ? handleSaveAs : undefined}>
            <span>{t('menu.file.saveAs')}</span><span className="text-[11px] text-[var(--text-dim)]">Ctrl+Shift+S</span>
          </div>
          {sep}
          <div className={itemCls(!!activeTabId)} onClick={activeTabId ? handleExportHtml : undefined}>
            <span>{t('menu.file.exportHtml')}</span>
          </div>
          <div className={itemCls(!!activeTabId)} onClick={activeTabId ? handleExportPdf : undefined}>
            <span>{t('menu.file.exportPdf')}</span>
          </div>
        </AnimatedMenu>
      </div>

      {/* === EDIT === */}
      <div className="relative">
        <button onClick={() => toggleMenu('edit')} className={menuBtnCls('edit')} style={{ padding: '2px 12px' }}>{t('menu.edit')}</button>
        <AnimatedMenu isOpen={openMenu === 'edit'} className="absolute top-full left-0 mt-1 w-48 py-1 bg-[var(--bg-elevated)] backdrop-blur-xl border border-[var(--border-strong)] rounded-xl shadow-2xl z-50">
          <div className="px-4 py-3 text-[12px] text-[var(--text-dim)] text-center italic">{t('menu.edit.empty')}</div>
        </AnimatedMenu>
      </div>

      {/* === VIEW === */}
      <div className="relative">
        <button onClick={() => toggleMenu('view')} className={menuBtnCls('view')} style={{ padding: '2px 12px' }}>{t('menu.view')}</button>
        <AnimatedMenu isOpen={openMenu === 'view'} className="absolute top-full left-0 mt-1 min-w-[240px] w-max py-1 bg-[var(--bg-elevated)] backdrop-blur-xl border border-[var(--border-strong)] rounded-xl shadow-2xl z-50">
          {/* Обновить */}
          <div className={itemCls(!!activeTabId)} onClick={activeTabId ? handleRefresh : undefined}>
            <span>{t('menu.view.refresh')}</span><span className="text-[11px] text-[var(--text-dim)]">F5</span>
          </div>
          {/* Боковая панель */}
          <div className={itemCls(true)} onClick={() => { closeMenu(); toggleSidebar() }}>
            <span>{state.sidebarOpen ? t('menu.view.collapseSidebar') : t('menu.view.expandSidebar')}</span><span className="text-[11px] text-[var(--text-dim)]">Ctrl+Shift+B</span>
          </div>
          {/* Панель вкладок */}
          <div className={itemCls(true)} onClick={() => { closeMenu(); toggleTabBar() }}>
            <span>{state.tabBarOpen ? t('menu.view.hideTabs') : t('menu.view.showTabs')}</span>
          </div>
          {sep}

          {/* Язык — подменю */}
          <div
            className="menu-item enabled relative"
            onMouseEnter={() => setSubmenu('language')}
            onMouseLeave={() => setSubmenu(null)}
          >
            <span>{t('menu.view.language')}</span>
            <ChevronRight size={14} className="text-[var(--text-dim)]" />
            <AnimatedMenu
              isOpen={submenu === 'language'}
              isSubmenu
              onMouseEnter={() => setSubmenu('language')}
              onMouseLeave={() => setSubmenu(null)}
              className="absolute left-full top-0 ml-0.5 w-44 py-1 bg-[var(--bg-elevated)] backdrop-blur-xl border border-[var(--border-strong)] rounded-xl shadow-2xl z-50"
            >
              <div className={`${itemCls(true)} gap-2`} onClick={() => handleSetLanguage('en')}>
                <RadioIcon active={language === 'en'} />
                <span>{t('menu.view.langEnglish')}</span>
              </div>
              <div className={`${itemCls(true)} gap-2`} onClick={() => handleSetLanguage('ru')}>
                <RadioIcon active={language === 'ru'} />
                <span>{t('menu.view.langRussian')}</span>
              </div>
            </AnimatedMenu>
          </div>

          {/* Тема — подменю */}
          <div
            className="menu-item enabled relative"
            onMouseEnter={() => setSubmenu('theme')}
            onMouseLeave={() => setSubmenu(null)}
          >
            <span>{t('menu.view.theme')}</span>
            <ChevronRight size={14} className="text-[var(--text-dim)]" />
            <AnimatedMenu
              isOpen={submenu === 'theme'}
              isSubmenu
              onMouseEnter={() => setSubmenu('theme')}
              onMouseLeave={() => setSubmenu(null)}
              className="absolute left-full top-0 ml-0.5 w-44 py-1 bg-[var(--bg-elevated)] backdrop-blur-xl border border-[var(--border-strong)] rounded-xl shadow-2xl z-50"
            >
              <div className={`${itemCls(true)} gap-2`} onClick={() => handleSetTheme('light')}>
                <RadioIcon active={theme === 'light'} />
                <span>{t('menu.view.themeLight')}</span>
              </div>
              <div className={`${itemCls(true)} gap-2`} onClick={() => handleSetTheme('dark')}>
                <RadioIcon active={theme === 'dark'} />
                <span>{t('menu.view.themeDark')}</span>
              </div>
              <div className={`${itemCls(true)} gap-2`} onClick={() => handleSetTheme('system')}>
                <RadioIcon active={theme === 'system'} />
                <span>{t('menu.view.themeSystem')}</span>
              </div>
            </AnimatedMenu>
          </div>

          {/* Акцентировать — подменю */}
          <div
            className="menu-item enabled relative"
            onMouseEnter={() => setSubmenu('focus')}
            onMouseLeave={() => setSubmenu(null)}
          >
            <span>{t('menu.view.focus')}</span>
            <ChevronRight size={14} className="text-[var(--text-dim)]" />
            <AnimatedMenu
              isOpen={submenu === 'focus'}
              isSubmenu
              onMouseEnter={() => setSubmenu('focus')}
              onMouseLeave={() => setSubmenu(null)}
              className="absolute left-full top-0 ml-0.5 w-52 py-1 bg-[var(--bg-elevated)] backdrop-blur-xl border border-[var(--border-strong)] rounded-xl shadow-2xl z-50"
            >
              <div className={`${itemCls(true)} gap-2`} onClick={() => handleSetFocusMode('none')}>
                <RadioIcon active={focusMode === 'none'} />
                <span>{t('menu.view.focusNone')}</span>
              </div>
              <div className={`${itemCls(true)} gap-2`} onClick={() => handleSetFocusMode('paragraph')}>
                <RadioIcon active={focusMode === 'paragraph'} />
                <span>{t('menu.view.focusParagraph')}</span>
              </div>
              <div className={`${itemCls(true)} gap-2`} onClick={() => handleSetFocusMode('lines')}>
                <RadioIcon active={focusMode === 'lines'} />
                <span>{t('menu.view.focusLines')}</span>
              </div>
              <div className={`${itemCls(true)} gap-2`} onClick={() => handleSetFocusMode('sentence')}>
                <RadioIcon active={focusMode === 'sentence'} />
                <span>{t('menu.view.focusSentence')}</span>
              </div>
            </AnimatedMenu>
          </div>

          {/* Положение оглавления — подменю */}
          <div
            className="menu-item enabled relative"
            onMouseEnter={() => setSubmenu('tocLayout')}
            onMouseLeave={() => setSubmenu(null)}
          >
            <span>{t('menu.view.tocPosition')}</span>
            <ChevronRight size={14} className="text-[var(--text-dim)]" />
            <AnimatedMenu
              isOpen={submenu === 'tocLayout'}
              isSubmenu
              onMouseEnter={() => setSubmenu('tocLayout')}
              onMouseLeave={() => setSubmenu(null)}
              className="absolute left-full top-0 ml-0.5 w-60 py-1 bg-[var(--bg-elevated)] backdrop-blur-xl border border-[var(--border-strong)] rounded-xl shadow-2xl z-50"
            >
              <div className={`${itemCls(true)} gap-2`} onClick={() => { closeMenu(); setTocLayoutMode('separate') }}>
                <RadioIcon active={state.tocLayoutMode === 'separate'} />
                <span>{t('menu.view.tocSidebar')}</span>
              </div>
              <div className={`${itemCls(true)} gap-2`} onClick={() => { closeMenu(); setTocLayoutMode('combined') }}>
                <RadioIcon active={state.tocLayoutMode === 'combined'} />
                <span>{t('menu.view.tocRight')}</span>
              </div>
            </AnimatedMenu>
          </div>

          {/* Положение статистики — подменю */}
          <div
            className="menu-item enabled relative"
            onMouseEnter={() => setSubmenu('statsLayout')}
            onMouseLeave={() => setSubmenu(null)}
          >
            <span>{t('menu.view.statsPosition')}</span>
            <ChevronRight size={14} className="text-[var(--text-dim)]" />
            <AnimatedMenu
              isOpen={submenu === 'statsLayout'}
              isSubmenu
              onMouseEnter={() => setSubmenu('statsLayout')}
              onMouseLeave={() => setSubmenu(null)}
              className="absolute left-full top-0 ml-0.5 w-60 py-1 bg-[var(--bg-elevated)] backdrop-blur-xl border border-[var(--border-strong)] rounded-xl shadow-2xl z-50"
            >
              <div className={`${itemCls(true)} gap-2`} onClick={() => { closeMenu(); setStatsLayoutMode('right') }}>
                <RadioIcon active={state.statsLayoutMode === 'right'} />
                <span>{t('menu.view.statsRight')}</span>
              </div>
              <div className={`${itemCls(true)} gap-2`} onClick={() => { closeMenu(); setStatsLayoutMode('sidebar') }}>
                <RadioIcon active={state.statsLayoutMode === 'sidebar'} />
                <span>{t('menu.view.statsSidebar')}</span>
              </div>
            </AnimatedMenu>
          </div>
        </AnimatedMenu>
      </div>
    </div>
  )
}

