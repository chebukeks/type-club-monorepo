/**
 * EditorContext.tsx — Централизованное управление состоянием приложения.
 */
import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react'
import type { AppState, AppAction, FileEntry, ThemeMode, EditorMode, WordLimit, FocusMode } from '../types'

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
      const { filePath, fileName, content } = action.payload
      const sep = filePath.includes('/') ? '/' : '\\'
      const dirPath = filePath.substring(0, filePath.lastIndexOf(sep))
      
      const existingTab = state.tabs.find((t) => t.filePath === filePath)
      if (existingTab) {
        return { ...state, activeTabId: existingTab.id, activeExplorerPath: dirPath }
      }
      const newTab = {
        id: crypto.randomUUID(),
        filePath, fileName, content,
        isModified: false,
        mode: 'seamless' as EditorMode,
        refreshCounter: 0,
      }
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
          t.id === tabId ? { ...t, content, isModified: true } : t
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
    case 'SET_ACTIVE_EXPLORER_PATH':
      return { ...state, activeExplorerPath: action.payload.path }
    case 'SET_THEME':
      return { ...state, theme: action.payload.theme }
    case 'SET_TAB_MODE':
      return { ...state, tabs: state.tabs.map((t) =>
        t.id === action.payload.tabId ? { ...t, mode: action.payload.mode } : t
      )}
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
  setTheme: (theme: ThemeMode) => Promise<void>
  setTabMode: (tabId: string, mode: EditorMode) => void
  refreshTab: (tabId: string) => void
  setAutosave: (enabled: boolean) => Promise<void>
  setShowStats: (enabled: boolean) => Promise<void>
  setWordLimit: (limit: WordLimit) => void
  setTypewriterMode: (enabled: boolean) => Promise<void>
  setFocusMode: (mode: FocusMode) => Promise<void>
  setShowEmptyFolders: (enabled: boolean) => Promise<void>
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

  // --- Открыть файл ---
  const openFile = useCallback(async (filePath: string, fileName: string) => {
    try {
      const content = await window.api.readFile(filePath)
      dispatch({ type: 'OPEN_FILE', payload: { filePath, fileName, content } })
    } catch (err) { /* ignore */ }
  }, [])

  // --- Сохранить ---
  const saveActiveFile = useCallback(async () => {
    const activeTab = state.tabs.find((t) => t.id === state.activeTabId)
    if (!activeTab) return
    try {
      await window.api.writeFile(activeTab.filePath, activeTab.content)
      dispatch({ type: 'MARK_SAVED', payload: { tabId: activeTab.id } })
    } catch (err) { console.error('Ошибка сохранения файла:', err) }
  }, [state.tabs, state.activeTabId])

  // --- Открыть папку ---
  const openFolder = useCallback(async () => {
    try {
      const folderPath = await window.api.openFolder()
      if (!folderPath) return
      const fileTree: FileEntry[] = await window.api.readDir(folderPath)
      dispatch({ type: 'SET_FILE_TREE', payload: { folderPath, fileTree } })
      await window.api.storeSet('lastFolderPath', folderPath)
    } catch (err) { /* ignore */ }
  }, [])

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

  // --- Установить режим вкладки ---
  const setTabMode = useCallback((tabId: string, mode: EditorMode) => {
    dispatch({ type: 'SET_TAB_MODE', payload: { tabId, mode } })
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
    if (!state.folderPath) return
    const targetPath = state.activeExplorerPath || state.folderPath
    dispatch({ type: 'START_CREATING', payload: { itemType: type, targetPath } })
  }, [state.activeExplorerPath, state.folderPath])

  // --- Установить активную директорию ---
  const setActiveExplorerPath = useCallback((path: string | null) => {
    dispatch({ type: 'SET_ACTIVE_EXPLORER_PATH', payload: { path } })
  }, [])

  // --- Установить видимость пустых папок ---
  const setShowEmptyFolders = useCallback(async (enabled: boolean) => {
    dispatch({ type: 'SET_SHOW_EMPTY_FOLDERS', payload: { enabled } })
    try { await window.api.storeSet('showEmptyFolders', enabled) } catch (e) { /* ignore */ }
  }, [])

  // ============================================================
  // Автосохранение: debounce 5 сек после последнего изменения
  // ============================================================
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveActiveFileRef = useRef(saveActiveFile)
  saveActiveFileRef.current = saveActiveFile

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId)
  const isModified = activeTab?.isModified ?? false

  useEffect(() => {
    if (!state.autosave || !isModified) return

    autosaveTimerRef.current = setTimeout(() => {
      saveActiveFileRef.current()
    }, 5000)

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [state.autosave, isModified, activeTab?.content])

  // --- Автосохранение при потере фокуса окна ---
  useEffect(() => {
    if (!state.autosave) return
    const handleBlur = () => {
      const tab = state.tabs.find((t) => t.id === state.activeTabId)
      if (tab?.isModified) {
        saveActiveFileRef.current()
      }
    }
    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [state.autosave, state.tabs, state.activeTabId])

  return (
    <EditorContext.Provider value={{
      state, dispatch,
      openFile, saveActiveFile, openFolder,
      openFileViaDialog, saveActiveFileAs,
      createFile, createFolder, refreshFileTree,
      startCreating, setActiveExplorerPath,
      setTheme, setTabMode, refreshTab,
      setAutosave, setShowStats, setWordLimit,
      setTypewriterMode, setFocusMode, setShowEmptyFolders
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
