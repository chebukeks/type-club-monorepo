import { useState, useRef, useEffect } from 'react'
import { useEditor } from '../context/EditorContext'
import { generateExportHtml } from '../editor/markdownConfig'
import type { Tab, ThemeMode, EditorMode } from '../types'

export function MenuBar() {
  const {
    state, dispatch,
    saveActiveFile, openFolder,
    openFileViaDialog, saveActiveFileAs,
    setTheme, setTabMode, refreshTab,
  } = useEditor()
  const { activeTabId, tabs, folderPath, theme } = state
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [submenu, setSubmenu] = useState<string | null>(null)
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
      else if (ctrl && !shift && code === 'KeyN') {
        e.preventDefault()
        if (folderPath) dispatch({ type: 'START_CREATING', payload: { itemType: 'file' } })
      }
      else if (ctrl && shift && code === 'KeyN') {
        e.preventDefault()
        if (folderPath) dispatch({ type: 'START_CREATING', payload: { itemType: 'folder' } })
      }
      else if (e.code === 'F5') {
        e.preventDefault()
        if (activeTabId) refreshTab(activeTabId)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [saveActiveFile, saveActiveFileAs, openFileViaDialog, openFolder, folderPath, dispatch, activeTabId, refreshTab])

  const closeMenu = () => { setOpenMenu(null); setSubmenu(null) }
  const toggleMenu = (name: string) => {
    if (openMenu === name) closeMenu()
    else { setOpenMenu(name); setSubmenu(null) }
  }

  // Обработчики File
  const handleExportHtml = async () => {
    closeMenu()
    if (!activeTab) return
    const html = generateExportHtml(activeTab.content)
    await window.api.exportHtml(html, activeTab.fileName.replace(/\.md$/i, '.html'))
  }
  const handleExportPdf = async () => {
    closeMenu()
    if (!activeTab) return
    const html = generateExportHtml(activeTab.content)
    await window.api.exportPdf(html, activeTab.fileName.replace(/\.md$/i, '.pdf'))
  }
  const handleCreateFile = () => { closeMenu(); if (folderPath) dispatch({ type: 'START_CREATING', payload: { itemType: 'file' } }) }
  const handleCreateFolder = () => { closeMenu(); if (folderPath) dispatch({ type: 'START_CREATING', payload: { itemType: 'folder' } }) }
  const handleOpenFile = () => { closeMenu(); openFileViaDialog() }
  const handleOpenFolder = () => { closeMenu(); openFolder() }
  const handleSave = () => { closeMenu(); saveActiveFile() }
  const handleSaveAs = () => { closeMenu(); saveActiveFileAs() }

  // Обработчики View
  const handleRefresh = () => { closeMenu(); if (activeTabId) refreshTab(activeTabId) }
  const handleSetTheme = (t: ThemeMode) => { closeMenu(); setTheme(t) }
  const handleSetMode = (m: EditorMode) => { closeMenu(); if (activeTabId) setTabMode(activeTabId, m) }

  const itemCls = (enabled: boolean) => `menu-item ${enabled ? 'enabled' : 'disabled'}`

  const sep = <div className="border-t border-[var(--border-strong)] my-1" />

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
        <button onClick={() => toggleMenu('file')} className={menuBtnCls('file')} style={{ padding: '2px 12px' }}>File</button>
        {openMenu === 'file' && (
          <div className="absolute top-full left-0 mt-1 w-60 py-1 bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-md shadow-lg z-50">
            <div className={itemCls(!!folderPath)} onClick={folderPath ? handleCreateFile : undefined}>
              <span>Создать файл</span><span className="text-[11px] text-[var(--text-dim)]">Ctrl+N</span>
            </div>
            <div className={itemCls(!!folderPath)} onClick={folderPath ? handleCreateFolder : undefined}>
              <span>Создать папку</span><span className="text-[11px] text-[var(--text-dim)]">Ctrl+Shift+N</span>
            </div>
            {sep}
            <div className={itemCls(true)} onClick={handleOpenFile}>
              <span>Открыть файл</span><span className="text-[11px] text-[var(--text-dim)]">Ctrl+O</span>
            </div>
            <div className={itemCls(true)} onClick={handleOpenFolder}>
              <span>Открыть папку</span><span className="text-[11px] text-[var(--text-dim)]">Ctrl+Shift+O</span>
            </div>
            {sep}
            <div className={itemCls(!!activeTabId)} onClick={activeTabId ? handleSave : undefined}>
              <span>Сохранить</span><span className="text-[11px] text-[var(--text-dim)]">Ctrl+S</span>
            </div>
            <div className={itemCls(!!activeTabId)} onClick={activeTabId ? handleSaveAs : undefined}>
              <span>Сохранить как...</span><span className="text-[11px] text-[var(--text-dim)]">Ctrl+Shift+S</span>
            </div>
            {sep}
            <div className={itemCls(!!activeTabId)} onClick={activeTabId ? handleExportHtml : undefined}>
              <span>Export to HTML...</span>
            </div>
            <div className={itemCls(!!activeTabId)} onClick={activeTabId ? handleExportPdf : undefined}>
              <span>Export to PDF...</span>
            </div>
          </div>
        )}
      </div>

      {/* === EDIT (заглушка) === */}
      <div className="relative">
        <button onClick={() => toggleMenu('edit')} className={menuBtnCls('edit')} style={{ padding: '2px 12px' }}>Edit</button>
        {openMenu === 'edit' && (
          <div className="absolute top-full left-0 mt-1 w-48 py-1 bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-md shadow-lg z-50">
            <div className="px-4 py-3 text-[12px] text-[var(--text-dim)] text-center italic">Пока ничего</div>
          </div>
        )}
      </div>

      {/* === VIEW === */}
      <div className="relative">
        <button onClick={() => toggleMenu('view')} className={menuBtnCls('view')} style={{ padding: '2px 12px' }}>View</button>
        {openMenu === 'view' && (
          <div className="absolute top-full left-0 mt-1 w-52 py-1 bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-md shadow-lg z-50">
            {/* Обновить */}
            <div className={itemCls(!!activeTabId)} onClick={activeTabId ? handleRefresh : undefined}>
              <span>Обновить</span><span className="text-[11px] text-[var(--text-dim)]">F5</span>
            </div>
            {sep}

            {/* Тема — подменю */}
            <div
              className="menu-item enabled relative"
              onMouseEnter={() => setSubmenu('theme')}
              onMouseLeave={() => setSubmenu(null)}
            >
              <span>Тема</span>
              <span className="text-[11px]">▸</span>
              {submenu === 'theme' && (
                <div className="absolute left-full top-0 ml-0.5 w-44 py-1 bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-md shadow-lg z-50"
                  onMouseEnter={() => setSubmenu('theme')} onMouseLeave={() => setSubmenu(null)}
                >
                  <div className={`${itemCls(true)} gap-2`} onClick={() => handleSetTheme('light')}>
                    <span>{theme === 'light' ? '●' : '○'} Светлая</span>
                  </div>
                  <div className={`${itemCls(true)} gap-2`} onClick={() => handleSetTheme('dark')}>
                    <span>{theme === 'dark' ? '●' : '○'} Тёмная</span>
                  </div>
                  <div className={`${itemCls(true)} gap-2`} onClick={() => handleSetTheme('system')}>
                    <span>{theme === 'system' ? '●' : '○'} Системная</span>
                  </div>
                </div>
              )}
            </div>

            {/* Режим — подменю */}
            <div
              className="menu-item enabled relative"
              onMouseEnter={() => setSubmenu('mode')}
              onMouseLeave={() => setSubmenu(null)}
            >
              <span>Режим</span>
              <span className="text-[11px]">▸</span>
              {submenu === 'mode' && (
                <div className="absolute left-full top-0 ml-0.5 w-44 py-1 bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-md shadow-lg z-50"
                  onMouseEnter={() => setSubmenu('mode')} onMouseLeave={() => setSubmenu(null)}
                >
                  <div className={`${itemCls(!!activeTabId)} gap-2`} onClick={activeTabId ? () => handleSetMode('raw') : undefined}>
                    <span>{activeTab?.mode === 'raw' ? '●' : '○'} Raw</span>
                  </div>
                  <div className={`${itemCls(!!activeTabId)} gap-2`} onClick={activeTabId ? () => handleSetMode('seamless') : undefined}>
                    <span>{activeTab?.mode === 'seamless' ? '●' : '○'} Seamless</span>
                  </div>
                  <div className={`${itemCls(!!activeTabId)} gap-2`} onClick={activeTabId ? () => handleSetMode('preview') : undefined}>
                    <span>{activeTab?.mode === 'preview' ? '●' : '○'} Preview</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
