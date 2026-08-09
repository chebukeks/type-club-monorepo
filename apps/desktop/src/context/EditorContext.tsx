/**
 * EditorContext.tsx — Централизованное управление состоянием приложения.
 */
import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react'
import type { AppState, AppAction, FileEntry, ThemeMode, EditorMode, WordLimit, FocusMode } from '../types'
import { articlesApi } from '../api'

// ============================================================
// Начальное состояние
// ============================================================
const initialState: AppState = {
  tabs: [],
  activeTabId: null,
  folderPath: null,
  fileTree: [],
  creating: null,
  theme: 'dark',
  autosave: true,
  wordLimit: { enabled: false, value: 1000, type: 'chars' },
  showStats: true,
  activeToc: [],
  typewriterMode: false,
  focusMode: 'none',
  activeExplorerPath: null,
  showEmptyFolders: true,
  renaming: null,
  editorMode: 'seamless',
  textZoom: 100,
  documentZoom: 100,
  sidebarMode: 'local' as 'local' | 'online',
  onlineArticles: [] as import('../api').ArticleListItem[],
  sidebarOpen: true,
}

// ============================================================
// Вспомогательные функции для темы
// ============================================================

/** Применить тему к DOM */
function applyThemeToDOM(theme: ThemeMode) {
  let resolved = theme
  if (theme === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  document.documentElement.setAttribute('data-theme', resolved)
}

// ============================================================
// Редьюсер
// ============================================================
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'OPEN_FILE': {
      const { filePath, fileName, content, articleId } = action.payload
      const sep = filePath.includes('/') ? '/' : '\\'
      const dirPath = articleId ? state.folderPath || null : filePath.substring(0, filePath.lastIndexOf(sep))
      
      const existingTab = state.tabs.find((t) => t.filePath === filePath)
      if (existingTab) {
        return { ...state, activeTabId: existingTab.id, activeExplorerPath: dirPath }
      }
      const newTab: any = {
        id: crypto.randomUUID(),
        filePath, fileName, content,
        isModified: false,
        refreshCounter: 0,
        scrollTop: 0,
      }
      if (articleId !== undefined) newTab.articleId = articleId
      return { ...state, tabs: [...state.tabs, newTab], activeTabId: newTab.id, activeExplorerPath: dirPath }
    }
    case 'CLOSE_TAB': {
      const { tabId } = action.payload
      const newTabs = state.tabs.filter((t) => t.id !== tabId)
      let newActiveId = state.activeTabId
      if (state.activeTabId === tabId) {
        const closedIndex = state.tabs.findIndex((t) => t.id === tabId)
        newActiveId = newTabs.length > 0
          ? newTabs[Math.min(closedIndex, newTabs.length - 1)].id : null
      }
      return { ...state, tabs: newTabs, activeTabId: newActiveId }
    }
    case 'SET_ACTIVE_TAB': {
      const targetTab = state.tabs.find(t => t.id === action.payload.tabId)
      let dirPath = state.activeExplorerPath
      if (targetTab) {
        const sep = targetTab.filePath.includes('/') ? '/' : '\\'
        dirPath = targetTab.filePath.substring(0, targetTab.filePath.lastIndexOf(sep))
      }
      return { ...state, activeTabId: action.payload.tabId, activeExplorerPath: dirPath }
    }
    case 'UPDATE_CONTENT': {
      const { tabId, content } = action.payload
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === tabId ? { ...t, content, isModified: t.articleId ? false : true } : t
        ),
      }
    }
    case 'SET_FILE_TREE':
      return { ...state, folderPath: action.payload.folderPath, fileTree: action.payload.fileTree }
    case 'MARK_SAVED':
      return { ...state, tabs: state.tabs.map((t) =>
        t.id === action.payload.tabId ? { ...t, isModified: false } : t
      )}
    case 'START_CREATING':
      return { ...state, creating: { type: action.payload.itemType, targetPath: action.payload.targetPath } }
    case 'STOP_CREATING':
      return { ...state, creating: null }
    case 'START_RENAMING':
      return { ...state, renaming: { path: action.payload.path, type: action.payload.itemType } }
    case 'STOP_RENAMING':
      return { ...state, renaming: null }
    case 'RENAME_TAB_PATHS': {
      const { oldPath, newPath } = action.payload
      const sep = oldPath.includes('/') ? '/' : '\\'
      const newTabs = state.tabs.map(tab => {
        if (tab.filePath === oldPath) {
          const newName = newPath.substring(newPath.lastIndexOf(sep) + 1)
          return { ...tab, filePath: newPath, fileName: newName }
        }
        if (tab.filePath.startsWith(oldPath + sep)) {
          const updatedPath = tab.filePath.replace(oldPath, newPath)
          return { ...tab, filePath: updatedPath }
        }
        return tab
      })
      return { ...state, tabs: newTabs }
    }
    case 'SET_ACTIVE_EXPLORER_PATH':
      return { ...state, activeExplorerPath: action.payload.path }
    case 'SET_THEME':
      return { ...state, theme: action.payload.theme }
    case 'SET_EDITOR_MODE':
      return { ...state, editorMode: action.payload.mode }
    case 'REFRESH_TAB':
      return { ...state, tabs: state.tabs.map((t) =>
        t.id === action.payload.tabId ? { ...t, refreshCounter: t.refreshCounter + 1 } : t
      )}
    case 'SET_AUTOSAVE':
      return { ...state, autosave: action.payload.enabled }
    case 'SET_SHOW_STATS':
      return { ...state, showStats: action.payload.enabled }
    case 'SET_WORD_LIMIT':
      return { ...state, wordLimit: action.payload }
    case 'SET_ACTIVE_TOC':
      return { ...state, activeToc: action.payload }
    case 'SET_TYPEWRITER_MODE':
      return { ...state, typewriterMode: action.payload.enabled }
    case 'SET_FOCUS_MODE':
      return { ...state, focusMode: action.payload.mode }
    case 'SET_SHOW_EMPTY_FOLDERS':
      return { ...state, showEmptyFolders: action.payload.enabled }
    case 'CLOSE_OTHER_TABS': {
      const keepTab = state.tabs.find(t => t.id === action.payload.tabId)
      if (!keepTab) return state
      return { ...state, tabs: [keepTab], activeTabId: keepTab.id }
    }
    case 'SAVE_SCROLL_POSITION':
      return { ...state, tabs: state.tabs.map(t =>
        t.id === action.payload.tabId ? { ...t, scrollTop: action.payload.scrollTop } : t
      )}
    case 'SET_TEXT_ZOOM':
      return { ...state, textZoom: action.payload.zoom }
    case 'SET_DOCUMENT_ZOOM':
      return { ...state, documentZoom: action.payload.zoom }
    case 'REORDER_TABS': {
      const { fromIndex, toIndex } = action.payload
      const newTabs = [...state.tabs]
      const [moved] = newTabs.splice(fromIndex, 1)
      newTabs.splice(toIndex, 0, moved)
      return { ...state, tabs: newTabs }
    }
    case 'SET_SIDEBAR_MODE':
      return { ...state, sidebarMode: action.payload.mode }
    case 'SET_ONLINE_ARTICLES':
      return { ...state, onlineArticles: action.payload.articles }
    case 'SET_SUGGESTION_MODE':
      return {
        ...state,
        tabs: state.tabs.map(t =>
          t.id === action.payload.tabId ? { ...t, suggestionMode: action.payload.active } : t
        ),
      }
    case 'TOGGLE_SIDEBAR': {
      const nextOpen = !state.sidebarOpen
      window.api.storeSet('sidebarOpen', nextOpen).catch(() => {})
      return { ...state, sidebarOpen: nextOpen }
    }
    case 'SET_SIDEBAR_OPEN': {
      window.api.storeSet('sidebarOpen', action.payload.open).catch(() => {})
      return { ...state, sidebarOpen: action.payload.open }
    }
    default:
      return state
  }
}

// ============================================================
// Контекст
// ============================================================
interface EditorContextValue {
  state: AppState
  dispatch: React.Dispatch<AppAction>
  openFile: (filePath: string, fileName: string) => Promise<void>
  saveActiveFile: () => Promise<void>
  openFolder: () => Promise<void>
  openFileViaDialog: () => Promise<void>
  saveActiveFileAs: () => Promise<void>
  createFile: (fileName: string, targetPath: string) => Promise<void>
  createFolder: (folderName: string, targetPath: string) => Promise<void>
  refreshFileTree: () => Promise<void>
  startCreating: (type: 'file' | 'folder') => void
  setActiveExplorerPath: (path: string | null) => void
  renameItem: (oldPath: string, newName: string, type: 'file' | 'folder') => Promise<void>
  deleteItem: (path: string, type: 'file' | 'folder', name: string) => Promise<void>
  showInExplorer: (path: string) => void
  startRenaming: (path: string, type: 'file' | 'folder') => void
  moveItem: (sourcePath: string, targetDirPath: string) => Promise<void>
  closeTab: (tabId: string) => Promise<void>
  setTheme: (theme: ThemeMode) => Promise<void>
  setEditorMode: (mode: EditorMode) => Promise<void>
  refreshTab: (tabId: string) => void
  setAutosave: (enabled: boolean) => Promise<void>
  setShowStats: (enabled: boolean) => Promise<void>
  setWordLimit: (limit: WordLimit) => void
  setTypewriterMode: (enabled: boolean) => Promise<void>
  setFocusMode: (mode: FocusMode) => Promise<void>
  setShowEmptyFolders: (enabled: boolean) => Promise<void>
  setTextZoom: (zoom: number) => void
  setDocumentZoom: (zoom: number) => void
  getRecentFiles: () => Promise<string[]>
  getRecentFolders: () => Promise<string[]>
  clearRecentFiles: () => Promise<void>
  clearRecentFolders: () => Promise<void>
  removeRecentFile: (filePath: string) => Promise<void>
  removeRecentFolder: (folderPath: string) => Promise<void>
  // --- Online articles ---
  fetchOnlineArticles: () => Promise<void>
  openOnlineArticle: (id: number) => Promise<void>
  saveOnlineArticle: (tabId: string) => Promise<void>
  deleteOnlineArticle: (id: number) => Promise<void>
  renameOnlineArticle: (id: number, title: string) => Promise<void>
  duplicateOnlineArticle: (id: number) => Promise<void>
  downloadOnlineArticle: (tabId: string) => Promise<void>
  setSidebarMode: (mode: 'local' | 'online') => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

const EditorContext = createContext<EditorContextValue | null>(null)

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  // --- Инициализация темы и autosave при загрузке ---
  useEffect(() => {
    (async () => {
      try {
        const savedTheme = await window.api.storeGet('theme') as ThemeMode | undefined
        const theme = savedTheme || 'dark'
        dispatch({ type: 'SET_THEME', payload: { theme } })
        applyThemeToDOM(theme)

        const savedAutosave = await window.api.storeGet('autosave') as boolean | undefined
        dispatch({ type: 'SET_AUTOSAVE', payload: { enabled: savedAutosave !== false } })

        const savedStats = await window.api.storeGet('showStats') as boolean | undefined
        dispatch({ type: 'SET_SHOW_STATS', payload: { enabled: savedStats !== false } })

        const savedTypewriter = await window.api.storeGet('typewriterMode') as boolean | undefined
        dispatch({ type: 'SET_TYPEWRITER_MODE', payload: { enabled: savedTypewriter === true } })

        const savedFocusMode = await window.api.storeGet('focusMode') as FocusMode | undefined
        dispatch({ type: 'SET_FOCUS_MODE', payload: { mode: savedFocusMode || 'none' } })

        const savedEmptyFolders = await window.api.storeGet('showEmptyFolders') as boolean | undefined
        dispatch({ type: 'SET_SHOW_EMPTY_FOLDERS', payload: { enabled: savedEmptyFolders !== false } })

        const savedEditorMode = await window.api.storeGet('editorMode') as EditorMode | undefined
        if (savedEditorMode) dispatch({ type: 'SET_EDITOR_MODE', payload: { mode: savedEditorMode } })

        const savedSidebarOpen = await window.api.storeGet('sidebarOpen') as boolean | undefined
        if (savedSidebarOpen !== undefined) dispatch({ type: 'SET_SIDEBAR_OPEN', payload: { open: savedSidebarOpen } })

        const savedTextZoom = await window.api.storeGet('textZoom') as number | undefined
        if (savedTextZoom) dispatch({ type: 'SET_TEXT_ZOOM', payload: { zoom: savedTextZoom } })

        const savedDocZoom = await window.api.storeGet('documentZoom') as number | undefined
        if (savedDocZoom) dispatch({ type: 'SET_DOCUMENT_ZOOM', payload: { zoom: savedDocZoom } })

        const lastFolder = await window.api.storeGet('lastFolderPath') as string | undefined
        if (lastFolder) {
          try {
            const fileTree = await window.api.readDir(lastFolder)
            // Устанавливаем дерево, если удалось прочитать (даже если пусто)
            dispatch({ type: 'SET_FILE_TREE', payload: { folderPath: lastFolder, fileTree } })
          } catch (e) {
            console.error('Не удалось восстановить папку:', e)
          }
        }

        // --- Обработка файлов, переданных при старте (Open with...) ---
        const startupFiles = await window.api.getFilesToOpen()
        console.log('[RENDERER] getFilesToOpen:', startupFiles.length, startupFiles)
        for (const p of startupFiles) {
          const name = p.replace(/^.*[\\/]/, '') || 'untitled.md'
          // Используем dispatch напрямую, так как openFile определен позже
          try {
            const content = await window.api.readFile(p)
            dispatch({ type: 'OPEN_FILE', payload: { filePath: p, fileName: name, content } })
          } catch (err) { /* ignore */ }
        }
      } catch (e) {
        applyThemeToDOM('dark')
      }
    })()
  }, [])

  // --- Подписка на изменение системной темы ---
  useEffect(() => {
    if (state.theme !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyThemeToDOM('system')
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [state.theme])
  
  // --- Подписка на открытие новых файлов (когда приложение уже запущено) ---
  useEffect(() => {
    const unsubscribe = window.api.onOpenFiles((paths) => {
      console.log('[RENDERER] onOpenFiles received:', paths.length, paths)
      ;(async () => {
        for (const p of paths) {
          const name = p.replace(/^.*[\\/]/, '') || 'untitled.md'
          try {
            const content = await window.api.readFile(p)
            dispatch({ type: 'OPEN_FILE', payload: { filePath: p, fileName: name, content } })
          } catch (err) { /* ignore */ }
        }
      })()
    })
    return unsubscribe
  }, [])

  // --- Недавние файлы ---
  const addRecentFile = useCallback(async (filePath: string) => {
    try {
      const recent = (await window.api.storeGet('recentFiles') as string[] | undefined) || []
      const updated = [filePath, ...recent.filter(f => f !== filePath)].slice(0, 10)
      await window.api.storeSet('recentFiles', updated)
    } catch (e) { /* ignore */ }
  }, [])
  const getRecentFiles = useCallback(async () => {
    try {
      return (await window.api.storeGet('recentFiles') as string[] | undefined) || []
    } catch { return [] }
  }, [])
  const clearRecentFiles = useCallback(async () => {
    try { await window.api.storeSet('recentFiles', []) } catch { /* ignore */ }
  }, [])

  const removeRecentFile = useCallback(async (filePath: string) => {
    try {
      const recent = (await window.api.storeGet('recentFiles') as string[] | undefined) || []
      const updated = recent.filter(f => f !== filePath)
      await window.api.storeSet('recentFiles', updated)
    } catch { /* ignore */ }
  }, [])

  // --- Недавние папки ---
  const addRecentFolder = useCallback(async (folderPath: string) => {
    try {
      const recent = (await window.api.storeGet('recentFolders') as string[] | undefined) || []
      const updated = [folderPath, ...recent.filter(f => f !== folderPath)].slice(0, 10)
      await window.api.storeSet('recentFolders', updated)
    } catch (e) { /* ignore */ }
  }, [])
  const getRecentFolders = useCallback(async () => {
    try {
      return (await window.api.storeGet('recentFolders') as string[] | undefined) || []
    } catch { return [] }
  }, [])
  const clearRecentFolders = useCallback(async () => {
    try { await window.api.storeSet('recentFolders', []) } catch { /* ignore */ }
  }, [])

  const removeRecentFolder = useCallback(async (folderPath: string) => {
    try {
      const recent = (await window.api.storeGet('recentFolders') as string[] | undefined) || []
      const updated = recent.filter(f => f !== folderPath)
      await window.api.storeSet('recentFolders', updated)
    } catch { /* ignore */ }
  }, [])

  // --- Открыть файл ---
  const openFile = useCallback(async (filePath: string, fileName: string) => {
    try {
      const content = await window.api.readFile(filePath)
      dispatch({ type: 'OPEN_FILE', payload: { filePath, fileName, content } })
      addRecentFile(filePath)
    } catch (err) { /* ignore */ }
  }, [addRecentFile])

  // --- Сохранить онлайн-статью ---
  const saveOnlineArticle = useCallback(async (tabId: string) => {
    const tab = state.tabs.find(t => t.id === tabId)
    if (!tab) return
    try {
      if (tab.articleId) {
        // Content is persisted continuously by collab-server. Only sync title via REST.
        await articlesApi.update(tab.articleId, { title: tab.fileName })
      } else {
        // Create new
        const slug = tab.fileName.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')
        const article = await articlesApi.create({ title: tab.fileName, content: tab.content, slug: slug || 'untitled' })
        // Update the tab with the server-assigned articleId
        dispatch({
          type: 'OPEN_FILE',
          payload: { filePath: `__online__/${article.id}`, fileName: article.title, content: article.content, articleId: article.id }
        })
        dispatch({ type: 'CLOSE_TAB', payload: { tabId } })
        return
      }
      dispatch({ type: 'MARK_SAVED', payload: { tabId: tab.id } })
    } catch (err) { console.error('Ошибка сохранения статьи:', err) }
  }, [state.tabs])

  // --- Сохранить ---
  const saveActiveFile = useCallback(async () => {
    const activeTab = state.tabs.find((t) => t.id === state.activeTabId)
    if (!activeTab) return
    if (activeTab.articleId || activeTab.filePath.startsWith('__online')) {
      await saveOnlineArticle(activeTab.id)
      return
    }
    try {
      await window.api.writeFile(activeTab.filePath, activeTab.content)
      dispatch({ type: 'MARK_SAVED', payload: { tabId: activeTab.id } })
    } catch (err) { console.error('Ошибка сохранения файла:', err) }
  }, [state.tabs, state.activeTabId, saveOnlineArticle])

  // --- Открыть папку ---
  const openFolder = useCallback(async () => {
    try {
      const folderPath = await window.api.openFolder()
      if (!folderPath) return
      const fileTree: FileEntry[] = await window.api.readDir(folderPath)
      dispatch({ type: 'SET_FILE_TREE', payload: { folderPath, fileTree } })
      await window.api.storeSet('lastFolderPath', folderPath)
      addRecentFolder(folderPath)
    } catch (err) { /* ignore */ }
  }, [addRecentFolder])

  // --- Открыть файл через диалог ---
  const openFileViaDialog = useCallback(async () => {
    try {
      const result = await window.api.openFile()
      if (!result) return
      const fileName = result.filePath.replace(/^.*[/]/, '') || 'untitled.md'
      dispatch({ type: 'OPEN_FILE', payload: { filePath: result.filePath, fileName, content: result.content } })
    } catch (err) { /* ignore */ }
  }, [])

  // --- Сохранить как... ---
  const saveActiveFileAs = useCallback(async () => {
    const activeTab = state.tabs.find((t) => t.id === state.activeTabId)
    if (!activeTab) return
    try {
      const result = await window.api.saveFileAs(activeTab.content, activeTab.fileName)
      if (!result) return
      const fileName = result.filePath.replace(/^.*[/]/, '') || 'untitled.md'
      dispatch({ type: 'OPEN_FILE', payload: { filePath: result.filePath, fileName, content: activeTab.content } })
      if (state.folderPath) {
        const fileTree: FileEntry[] = await window.api.readDir(state.folderPath)
        dispatch({ type: 'SET_FILE_TREE', payload: { folderPath: state.folderPath, fileTree } })
      }
    } catch (err) { /* ignore */ }
  }, [state.tabs, state.activeTabId, state.folderPath])

  // --- Создать .md файл ---
  const createFile = useCallback(async (fileName: string, targetPath: string) => {
    try {
      const fullName = fileName.endsWith('.md') ? fileName : fileName + '.md'
      const sep = targetPath.includes('/') ? '/' : '\\'
      const filePath = targetPath + sep + fullName
      await window.api.writeFile(filePath, '')
      dispatch({ type: 'OPEN_FILE', payload: { filePath, fileName: fullName, content: '' } })
      
      if (state.folderPath) {
        const fileTree: FileEntry[] = await window.api.readDir(state.folderPath)
        dispatch({ type: 'SET_FILE_TREE', payload: { folderPath: state.folderPath, fileTree } })
      }
      dispatch({ type: 'STOP_CREATING' })
    } catch (err) {
      console.error('Ошибка создания файла:', err)
      dispatch({ type: 'STOP_CREATING' })
    }
  }, [state.folderPath])

  // --- Создать подпапку ---
  const createFolder = useCallback(async (folderName: string, targetPath: string) => {
    try {
      const sep = targetPath.includes('/') ? '/' : '\\'
      const dirPath = targetPath + sep + folderName
      await window.api.createDir(dirPath)
      
      if (state.folderPath) {
        const fileTree: FileEntry[] = await window.api.readDir(state.folderPath)
        dispatch({ type: 'SET_FILE_TREE', payload: { folderPath: state.folderPath, fileTree } })
      }
      dispatch({ type: 'STOP_CREATING' })
    } catch (err) {
      console.error('Ошибка создания папки:', err)
      dispatch({ type: 'STOP_CREATING' })
    }
  }, [state.folderPath])

  // --- Обновить дерево файлов ---
  const refreshFileTree = useCallback(async () => {
    if (!state.folderPath) return
    try {
      const fileTree: FileEntry[] = await window.api.readDir(state.folderPath)
      dispatch({ type: 'SET_FILE_TREE', payload: { folderPath: state.folderPath, fileTree } })
    } catch (err) { /* ignore */ }
  }, [state.folderPath])

  // --- Установить тему ---
  const setTheme = useCallback(async (theme: ThemeMode) => {
    dispatch({ type: 'SET_THEME', payload: { theme } })
    applyThemeToDOM(theme)
    try { await window.api.storeSet('theme', theme) } catch (e) { /* ignore */ }
  }, [])

  // --- Установить режим редактирования (глобальный) ---
  const setEditorMode = useCallback(async (mode: EditorMode) => {
    dispatch({ type: 'SET_EDITOR_MODE', payload: { mode } })
    try { await window.api.storeSet('editorMode', mode) } catch (e) { /* ignore */ }
  }, [])

  // --- Масштаб текста (Ctrl+Shift++/-) ---
  const textZoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setTextZoom = useCallback((zoom: number) => {
    const clamped = Math.max(50, Math.min(200, zoom))
    dispatch({ type: 'SET_TEXT_ZOOM', payload: { zoom: clamped } })
    
    if (textZoomTimeoutRef.current) clearTimeout(textZoomTimeoutRef.current)
    textZoomTimeoutRef.current = setTimeout(() => {
      window.api.storeSet('textZoom', clamped).catch(() => {})
    }, 500)
  }, [])

  // --- Масштаб документа (Ctrl+Scroll, Ctrl+Alt++/-) ---
  const docZoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setDocumentZoom = useCallback((zoom: number) => {
    const clamped = Math.max(50, Math.min(300, zoom))
    dispatch({ type: 'SET_DOCUMENT_ZOOM', payload: { zoom: clamped } })
    
    if (docZoomTimeoutRef.current) clearTimeout(docZoomTimeoutRef.current)
    docZoomTimeoutRef.current = setTimeout(() => {
      window.api.storeSet('documentZoom', clamped).catch(() => {})
    }, 500)
  }, [])

  // --- Обновить вкладку ---
  const refreshTab = useCallback((tabId: string) => {
    dispatch({ type: 'REFRESH_TAB', payload: { tabId } })
  }, [])

  // --- Установить автосохранение ---
  const setAutosave = useCallback(async (enabled: boolean) => {
    dispatch({ type: 'SET_AUTOSAVE', payload: { enabled } })
    try { await window.api.storeSet('autosave', enabled) } catch (e) { /* ignore */ }
  }, [])

  // --- Установить показ статистики ---
  const setShowStats = useCallback(async (enabled: boolean) => {
    dispatch({ type: 'SET_SHOW_STATS', payload: { enabled } })
    try { await window.api.storeSet('showStats', enabled) } catch (e) { /* ignore */ }
  }, [])

  // --- Установить режим печатной машинки ---
  const setTypewriterMode = useCallback(async (enabled: boolean) => {
    dispatch({ type: 'SET_TYPEWRITER_MODE', payload: { enabled } })
    try { await window.api.storeSet('typewriterMode', enabled) } catch (e) { /* ignore */ }
  }, [])

  // --- Установить режим акцентирования ---
  const setFocusMode = useCallback(async (mode: FocusMode) => {
    dispatch({ type: 'SET_FOCUS_MODE', payload: { mode } })
    try { await window.api.storeSet('focusMode', mode) } catch (e) { /* ignore */ }
  }, [])

  // --- Установить лимит ---
  const setWordLimit = useCallback((limit: WordLimit) => {
    dispatch({ type: 'SET_WORD_LIMIT', payload: limit })
  }, [])

  // --- Начать создание элемента ---
  const startCreating = useCallback((type: 'file' | 'folder') => {
    if (state.sidebarMode === 'online') {
      dispatch({ type: 'START_CREATING', payload: { itemType: 'file', targetPath: '__online__' } })
      return
    }
    if (!state.folderPath) return
    const targetPath = state.activeExplorerPath || state.folderPath
    dispatch({ type: 'START_CREATING', payload: { itemType: type, targetPath } })
  }, [state.activeExplorerPath, state.folderPath, state.sidebarMode])

  // --- Установить активную директорию ---
  const setActiveExplorerPath = useCallback((path: string | null) => {
    dispatch({ type: 'SET_ACTIVE_EXPLORER_PATH', payload: { path } })
  }, [])

  // --- Установить видимость пустых папок ---
  const setShowEmptyFolders = useCallback(async (enabled: boolean) => {
    dispatch({ type: 'SET_SHOW_EMPTY_FOLDERS', payload: { enabled } })
    try { await window.api.storeSet('showEmptyFolders', enabled) } catch (e) { /* ignore */ }
  }, [])

  // --- Начать переименование ---
  const startRenaming = useCallback((path: string, type: 'file' | 'folder') => {
    dispatch({ type: 'START_RENAMING', payload: { path, itemType: type } })
  }, [])

  // --- Переименовать ---
  const renameItem = useCallback(async (oldPath: string, newName: string, type: 'file' | 'folder') => {
    try {
      const sep = oldPath.includes('/') ? '/' : '\\'
      const dirPath = oldPath.substring(0, oldPath.lastIndexOf(sep))
      const finalName = (type === 'file' && !newName.endsWith('.md')) ? newName + '.md' : newName
      const newPath = dirPath + sep + finalName
      
      if (oldPath === newPath) {
        dispatch({ type: 'STOP_RENAMING' })
        return
      }

      await window.api.renameItem(oldPath, newPath)
      dispatch({ type: 'RENAME_TAB_PATHS', payload: { oldPath, newPath } })
      refreshFileTree()
      dispatch({ type: 'STOP_RENAMING' })
    } catch (err) {
      console.error(err)
    }
  }, [refreshFileTree])

  // --- Перемещение (Drag & Drop) ---
  const moveItem = useCallback(async (sourcePath: string, targetDirPath: string) => {
    try {
      const sep = sourcePath.includes('/') ? '/' : '\\'
      const fileName = sourcePath.substring(sourcePath.lastIndexOf(sep) + 1)
      const newPath = targetDirPath + sep + fileName

      if (sourcePath === newPath) return // Уже там
      // Проверяем, не пытаются ли переместить папку внутрь самой себя
      if (targetDirPath.startsWith(sourcePath + sep) || targetDirPath === sourcePath) return

      await window.api.renameItem(sourcePath, newPath)
      dispatch({ type: 'RENAME_TAB_PATHS', payload: { oldPath: sourcePath, newPath } })
      refreshFileTree()
    } catch (err) {
      console.error(err)
    }
  }, [refreshFileTree])

  // --- Удалить ---
  const deleteItem = useCallback(async (delPath: string, _type: 'file' | 'folder', name: string) => {
    const confirm = await window.api.confirmDelete(name)
    if (!confirm) return
    try {
      await window.api.deleteItem(delPath)
      const sep = delPath.includes('/') ? '/' : '\\'
      state.tabs.forEach(t => {
        if (t.filePath === delPath || t.filePath.startsWith(delPath + sep)) {
          dispatch({ type: 'CLOSE_TAB', payload: { tabId: t.id } })
        }
      })
      refreshFileTree()
    } catch (err) {
      console.error(err)
    }
  }, [state.tabs, refreshFileTree])

  // --- Показать в проводнике ---
  const showInExplorer = useCallback((path: string) => {
    window.api.showItemInFolder(path)
  }, [])

  // ============================================================
  // Автосохранение: debounce 1 сек после последнего изменения
  // ============================================================
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveActiveFileRef = useRef(saveActiveFile)
  saveActiveFileRef.current = saveActiveFile
  const saveOnlineArticleRef = useRef(saveOnlineArticle)
  saveOnlineArticleRef.current = saveOnlineArticle

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId)
  const isModified = activeTab?.isModified ?? false

  useEffect(() => {
    if (!state.autosave || !isModified) return
    // Skip online tabs (they use interval-based autosave)
    if (activeTab?.articleId) return

    autosaveTimerRef.current = setTimeout(() => {
      saveActiveFileRef.current()
    }, 1000)

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [state.autosave, isModified, activeTab?.content, activeTab?.articleId])

  // --- Автосохранение при потере фокуса окна ---
  useEffect(() => {
    if (!state.autosave) return
    const handleBlur = () => {
      const tab = state.tabs.find((t) => t.id === state.activeTabId)
      if (tab?.isModified) {
        if (tab.articleId) {
          saveOnlineArticleRef.current(tab.id)
        } else {
          saveActiveFileRef.current()
        }
      }
    }
    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [state.autosave, state.tabs, state.activeTabId])

  // --- Автосохранение при переключении вкладки ---
  const prevActiveTabIdRef = useRef<string | null>(state.activeTabId)
  useEffect(() => {
    if (prevActiveTabIdRef.current && prevActiveTabIdRef.current !== state.activeTabId && state.autosave) {
      const prevTab = state.tabs.find(t => t.id === prevActiveTabIdRef.current)
      if (prevTab?.isModified) {
        // Сохраняем предыдущую вкладку
        void (async () => {
          try {
            if (prevTab.articleId) {
              await articlesApi.update(prevTab.articleId, { title: prevTab.fileName, content: prevTab.content })
            } else {
              await window.api.writeFile(prevTab.filePath, prevTab.content)
            }
            dispatch({ type: 'MARK_SAVED', payload: { tabId: prevTab.id } })
          } catch (err) { console.error('Ошибка автосохранения при переключении:', err) }
        })()
      }
    }
    prevActiveTabIdRef.current = state.activeTabId
  }, [state.activeTabId, state.autosave])

  // --- Автосохранение онлайн-статей: интервал 20 сек ---
  useEffect(() => {
    if (!state.autosave) return
    const interval = setInterval(() => {
      for (const tab of state.tabs) {
        if (tab.articleId && tab.isModified) {
          saveOnlineArticleRef.current(tab.id)
        }
      }
    }, 20000)
    return () => clearInterval(interval)
  }, [state.autosave, state.tabs])

  // --- Диалог при закрытии окна (#16) ---
  const stateRef = useRef(state)
  stateRef.current = state
  useEffect(() => {
    const unsubscribe = window.api.onBeforeClose(async () => {
      const currentState = stateRef.current
      const modifiedTabs = currentState.tabs.filter(t => t.isModified)
      if (modifiedTabs.length === 0) {
        window.api.confirmClose()
        return
      }
      const fileNames = modifiedTabs.map(t => t.fileName)
      const result = await window.api.confirmExit(fileNames)
      if (result === 'save') {
        // Сохраняем все несохранённые файлы
        for (const tab of modifiedTabs) {
          try {
            if (tab.articleId) {
              await articlesApi.update(tab.articleId, { title: tab.fileName, content: tab.content })
            } else {
              await window.api.writeFile(tab.filePath, tab.content)
            }
          } catch (err) { console.error('Ошибка сохранения:', err) }
        }
        window.api.confirmClose()
      } else if (result === 'discard') {
        window.api.confirmClose()
      }
      // 'cancel' — ничего не делаем, окно не закроется
    })
    return unsubscribe
  }, [])

  // --- Закрытие вкладки с проверкой несохранённых изменений ---
  const closeTab = useCallback(async (tabId: string) => {
    const tab = state.tabs.find(t => t.id === tabId)
    if (tab?.articleId) {
      dispatch({ type: 'CLOSE_TAB', payload: { tabId } })
      return
    }
    if (tab?.isModified) {
      const result = await window.api.confirmExit([tab.fileName])
      if (result === 'save') {
        try {
          await window.api.writeFile(tab.filePath, tab.content)
          dispatch({ type: 'MARK_SAVED', payload: { tabId: tab.id } })
        } catch (err) { console.error('Ошибка сохранения:', err) }
        dispatch({ type: 'CLOSE_TAB', payload: { tabId } })
      } else if (result === 'discard') {
        dispatch({ type: 'CLOSE_TAB', payload: { tabId } })
      }
    } else {
      dispatch({ type: 'CLOSE_TAB', payload: { tabId } })
    }
  }, [state.tabs])

  // ============================================================
  // Online articles
  // ============================================================

  const fetchOnlineArticles = useCallback(async () => {
    try {
      const articles = await articlesApi.myListPaged({ page: 1, size: 100, roles: ['author', 'co_author', 'editor'] })
      dispatch({ type: 'SET_ONLINE_ARTICLES', payload: { articles: articles || [] } })
    } catch (err) { console.error('Ошибка загрузки статей:', err) }
  }, [])

  const openOnlineArticle = useCallback(async (id: number) => {
    try {
      // Check if already open
      const existing = state.tabs.find(t => t.articleId === id)
      if (existing) {
        dispatch({ type: 'SET_ACTIVE_TAB', payload: { tabId: existing.id } })
        return
      }
      const article = await articlesApi.get(id)
      dispatch({
        type: 'OPEN_FILE',
        payload: {
          filePath: `__online__/${id}`,
          fileName: article.title,
          content: article.content,
          articleId: article.id,
        }
      })
    } catch (err) { console.error('Ошибка открытия статьи:', err) }
  }, [state.tabs])

  // saveOnlineArticle defined earlier (before saveActiveFile)

  const deleteOnlineArticle = useCallback(async (id: number) => {
    try {
      await articlesApi.delete(id)
      state.tabs.filter(t => t.articleId === id).forEach(t => {
        dispatch({ type: 'CLOSE_TAB', payload: { tabId: t.id } })
      })
      await fetchOnlineArticles()
    } catch (err) { console.error('Ошибка удаления статьи:', err) }
  }, [state.tabs, fetchOnlineArticles])

  const renameOnlineArticle = useCallback(async (id: number, title: string) => {
    try {
      await articlesApi.update(id, { title })
      state.tabs.filter(t => t.articleId === id).forEach(t => {
        dispatch({ type: 'CLOSE_TAB', payload: { tabId: t.id } })
      })
      await fetchOnlineArticles()
    } catch (err) { console.error('Ошибка переименования:', err) }
  }, [state.tabs, fetchOnlineArticles])

  const duplicateOnlineArticle = useCallback(async (id: number) => {
    try {
      const article = await articlesApi.get(id)
      const baseSlug = (article.slug || article.title.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')) || 'untitled'
      await articlesApi.create({
        title: article.title + ' копия',
        content: article.content,
        slug: baseSlug + '-copy',
      })
      await fetchOnlineArticles()
    } catch (err) { console.error('Ошибка копирования:', err) }
  }, [fetchOnlineArticles])

  const downloadOnlineArticle = useCallback(async (tabId: string) => {
    const tab = state.tabs.find(t => t.id === tabId)
    if (!tab) return
    try {
      const result = await window.api.saveFileAs(tab.content, tab.fileName + '.md')
      if (!result) return
    } catch (err) { console.error('Ошибка скачивания:', err) }
  }, [state.tabs])

  const setSidebarMode = useCallback((mode: 'local' | 'online') => {
    dispatch({ type: 'SET_SIDEBAR_MODE', payload: { mode } })
    if (mode === 'online') {
      fetchOnlineArticles()
    }
  }, [fetchOnlineArticles])

  const toggleSidebar = useCallback(() => {
    dispatch({ type: 'TOGGLE_SIDEBAR' })
  }, [])

  const setSidebarOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_SIDEBAR_OPEN', payload: { open } })
  }, [])

  return (
    <EditorContext.Provider value={{
      state, dispatch,
      openFile, saveActiveFile, openFolder,
      openFileViaDialog, saveActiveFileAs,
      createFile, createFolder, refreshFileTree,
      startCreating, setActiveExplorerPath,
      renameItem, deleteItem, showInExplorer, startRenaming, moveItem,
      closeTab,
      setTheme, setEditorMode, refreshTab,
      setAutosave, setShowStats, setWordLimit,
      setTypewriterMode, setFocusMode, setShowEmptyFolders,
      setTextZoom, setDocumentZoom,
      getRecentFiles, getRecentFolders, clearRecentFiles, clearRecentFolders,
      removeRecentFile, removeRecentFolder,
      // Online articles
      fetchOnlineArticles, openOnlineArticle, saveOnlineArticle,
      deleteOnlineArticle, renameOnlineArticle, duplicateOnlineArticle,
      downloadOnlineArticle, setSidebarMode,
      toggleSidebar, setSidebarOpen,
    }}>
      {children}
    </EditorContext.Provider>
  )
}

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditor должен использоваться внутри EditorProvider')
  return ctx
}
