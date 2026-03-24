/**
 * EditorContext.tsx — Централизованное управление состоянием приложения.
 * Использует React Context + useReducer для хранения:
 * - списка вкладок (tabs)
 * - активной вкладки (activeTabId)
 * - дерева файлов (fileTree)
 * - пути к рабочей папке (folderPath)
 */
import React, { createContext, useContext, useReducer, useCallback } from 'react'
import type { AppState, AppAction, FileEntry } from '../types'

// ============================================================
// Начальное состояние
// ============================================================
const initialState: AppState = {
  tabs: [],
  activeTabId: null,
  folderPath: null,
  fileTree: [],
}

// ============================================================
// Редьюсер — обработка всех действий
// ============================================================
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'OPEN_FILE': {
      const { filePath, fileName, content } = action.payload
      // Проверяем, не открыт ли уже этот файл
      const existingTab = state.tabs.find((t) => t.filePath === filePath)
      if (existingTab) {
        return { ...state, activeTabId: existingTab.id }
      }
      // Создаём новую вкладку
      const newTab = {
        id: crypto.randomUUID(),
        filePath,
        fileName,
        content,
        isModified: false,
      }
      return {
        ...state,
        tabs: [...state.tabs, newTab],
        activeTabId: newTab.id,
      }
    }

    case 'CLOSE_TAB': {
      const { tabId } = action.payload
      const newTabs = state.tabs.filter((t) => t.id !== tabId)
      let newActiveId = state.activeTabId
      // Если закрыли активную вкладку — переключаемся
      if (state.activeTabId === tabId) {
        const closedIndex = state.tabs.findIndex((t) => t.id === tabId)
        newActiveId =
          newTabs.length > 0
            ? newTabs[Math.min(closedIndex, newTabs.length - 1)].id
            : null
      }
      return { ...state, tabs: newTabs, activeTabId: newActiveId }
    }

    case 'SET_ACTIVE_TAB': {
      return { ...state, activeTabId: action.payload.tabId }
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

    case 'SET_FILE_TREE': {
      return {
        ...state,
        folderPath: action.payload.folderPath,
        fileTree: action.payload.fileTree,
      }
    }

    case 'MARK_SAVED': {
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.payload.tabId ? { ...t, isModified: false } : t
        ),
      }
    }

    default:
      return state
  }
}

// ============================================================
// Контекст и хук
// ============================================================

interface EditorContextValue {
  state: AppState
  dispatch: React.Dispatch<AppAction>
  /** Открыть файл во вкладке */
  openFile: (filePath: string, fileName: string) => Promise<void>
  /** Сохранить активную вкладку */
  saveActiveFile: () => Promise<void>
  /** Открыть папку через диалог */
  openFolder: () => Promise<void>
}

const EditorContext = createContext<EditorContextValue | null>(null)

/** Провайдер контекста — оборачивает всё приложение */
export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  // --- Открыть файл и создать вкладку ---
  const openFile = useCallback(async (filePath: string, fileName: string) => {
    try {
      const content = await window.api.readFile(filePath)
      dispatch({
        type: 'OPEN_FILE',
        payload: { filePath, fileName, content },
      })
    } catch (err) {
      console.error('Ошибка чтения файла:', err)
    }
  }, [])

  // --- Сохранить текущий файл ---
  const saveActiveFile = useCallback(async () => {
    const activeTab = state.tabs.find((t) => t.id === state.activeTabId)
    if (!activeTab) return
    try {
      await window.api.writeFile(activeTab.filePath, activeTab.content)
      dispatch({ type: 'MARK_SAVED', payload: { tabId: activeTab.id } })
    } catch (err) {
      console.error('Ошибка сохранения файла:', err)
    }
  }, [state.tabs, state.activeTabId])

  // --- Открыть папку ---
  const openFolder = useCallback(async () => {
    try {
      const folderPath = await window.api.openFolder()
      if (!folderPath) return
      const fileTree: FileEntry[] = await window.api.readDir(folderPath)
      dispatch({
        type: 'SET_FILE_TREE',
        payload: { folderPath, fileTree },
      })
    } catch (err) {
      console.error('Ошибка открытия папки:', err)
    }
  }, [])

  return (
    <EditorContext.Provider value={{ state, dispatch, openFile, saveActiveFile, openFolder }}>
      {children}
    </EditorContext.Provider>
  )
}

/** Хук для доступа к контексту редактора */
export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext)
  if (!ctx) {
    throw new Error('useEditor должен использоваться внутри EditorProvider')
  }
  return ctx
}
