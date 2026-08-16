import { ipcRenderer, contextBridge, webFrame } from 'electron'

/**
 * Preload-скрипт: создаёт безопасный мост между Main и Renderer процессами.
 * Все вызовы Node.js API проходят через ipcRenderer.invoke / ipcRenderer.send.
 * Renderer-процесс получает доступ через window.api.
 */
contextBridge.exposeInMainWorld('api', {
  // ==========================================
  // Файловая система
  // ==========================================

  /** Чтение содержимого .md файла */
  readFile: (filePath: string): Promise<string> => {
    return ipcRenderer.invoke('fs:readFile', filePath)
  },

  /** Сохранение содержимого в файл */
  writeFile: (filePath: string, content: string): Promise<void> => {
    return ipcRenderer.invoke('fs:writeFile', filePath, content)
  },

  /** Получение дерева файлов в директории */
  readDir: (dirPath: string) => {
    return ipcRenderer.invoke('fs:readDir', dirPath)
  },

  /** Проверка существования файла/папки */
  exists: (filePath: string): Promise<boolean> => {
    return ipcRenderer.invoke('fs:exists', filePath)
  },

  /** Создание директории */
  createDir: (dirPath: string) => {
    return ipcRenderer.invoke('fs:createDir', dirPath)
  },

  /** Переименование файла/папки */
  renameItem: (oldPath: string, newPath: string) => {
    return ipcRenderer.invoke('fs:rename', oldPath, newPath)
  },

  /** Удаление файла/папки (в корзину) */
  deleteItem: (filePath: string) => {
    return ipcRenderer.invoke('fs:delete', filePath)
  },

  /** Показать файл/папку в системном проводнике */
  showItemInFolder: (filePath: string) => {
    ipcRenderer.send('shell:showItemInFolder', filePath)
  },

  // ==========================================
  // Диалоговые окна
  // ==========================================

  /** Открыть диалог выбора папки */
  openFolder: () => {
    return ipcRenderer.invoke('dialog:openFolder')
  },

  /** Открыть диалог выбора .md файла */
  openFile: () => {
    return ipcRenderer.invoke('dialog:openFile')
  },

  /** Сохранить как... (диалог + запись) */
  saveFileAs: (content: string, defaultName: string) => {
    return ipcRenderer.invoke('dialog:saveFileAs', content, defaultName)
  },

  /** Диалог подтверждения удаления */
  confirmDelete: (itemName: string) => {
    return ipcRenderer.invoke('dialog:confirmDelete', itemName)
  },

  /** Экспорт в HTML (откроет диалог сохранения) */
  exportHtml: (content: string, defaultName: string) => {
    return ipcRenderer.invoke('export:html', content, defaultName)
  },

  /** Экспорт в PDF (откроет диалог сохранения) */
  exportPdf: (htmlContent: string, defaultName: string) => {
    return ipcRenderer.invoke('export:pdf', htmlContent, defaultName)
  },

  // ==========================================
  // Хранилище настроек (electron-store)
  // ==========================================

  /** Получить значение из хранилища */
  storeGet: (key: string) => {
    return ipcRenderer.invoke('store:get', key)
  },

  /** Сохранить значение в хранилище */
  storeSet: (key: string, value: unknown) => {
    return ipcRenderer.invoke('store:set', key, value)
  },

  // ==========================================
  // Спеллчекер
  // ==========================================

  /** Включить/выключить проверку орфографии */
  setSpellcheck: (enabled: boolean): Promise<void> => {
    return ipcRenderer.invoke('spellcheck:set', enabled)
  },

  /** Получить текущее состояние спеллчекера */
  getSpellcheck: (): Promise<boolean> => {
    return ipcRenderer.invoke('spellcheck:get')
  },

  /** Получить активные языки проверки орфографии */
  getSpellcheckLanguages: (): Promise<string[]> => {
    return ipcRenderer.invoke('spellcheck:getLanguages')
  },

  /** Установить активные языки проверки орфографии */
  setSpellcheckLanguages: (languages: string[]): Promise<boolean> => {
    return ipcRenderer.invoke('spellcheck:setLanguages', languages)
  },

  /** Получить список пользовательских слов */
  getCustomDictionaryWords: (): Promise<string[]> => {
    return ipcRenderer.invoke('spellcheck:getCustomWords')
  },

  /** Добавить слово в пользовательский словарь */
  addCustomWord: (word: string): Promise<boolean> => {
    return ipcRenderer.invoke('spellcheck:addCustomWord', word)
  },

  /** Удалить слово из пользовательского словаря */
  removeCustomWord: (word: string): Promise<boolean> => {
    return ipcRenderer.invoke('spellcheck:removeCustomWord', word)
  },

  /** Проверить, считается ли слово ошибочным по спеллчекеру */
  isWordMisspelled: (word: string): boolean => {
    try {
      return webFrame.isWordMisspelled(word)
    } catch {
      return false
    }
  },

  /** Получить варианты исправлений для слова */
  getWordSuggestions: (word: string): string[] => {
    try {
      return webFrame.getWordSuggestions(word)
    } catch {
      return []
    }
  },

  /** Подписаться на данные контекстного меню спеллчекера */
  onContextMenuInfo: (callback: (info: { misspelledWord: string; dictionarySuggestions: string[]; x: number; y: number }) => void) => {
    const subscription = (_event: unknown, info: { misspelledWord: string; dictionarySuggestions: string[]; x: number; y: number }) => callback(info)
    ipcRenderer.on('context-menu-info', subscription)
    return () => ipcRenderer.off('context-menu-info', subscription)
  },

  // ==========================================
  // Управление окном (frameless window)
  // ==========================================

  /** Свернуть окно */
  minimizeWindow: () => ipcRenderer.send('window:minimize'),

  /** Развернуть/восстановить окно */
  maximizeWindow: () => ipcRenderer.send('window:maximize'),

  /** Закрыть окно */
  closeWindow: () => ipcRenderer.send('window:close'),

  /** Открыть внешнюю ссылку в браузере */
  openExternal: (url: string) => ipcRenderer.send('window:openExternal', url),

  // ==========================================
  // Открытие файлов через систему
  // ==========================================

  /** Получить файлы, переданные при старте (Open with...) */
  getFilesToOpen: (): Promise<string[]> => {
    return ipcRenderer.invoke('app:get-files-to-open')
  },

  /** Подписаться на открытие новых файлов (когда приложение уже запущено) */
  onOpenFiles: (callback: (paths: string[]) => void) => {
    const subscription = (_event: unknown, paths: string[]) => callback(paths)
    ipcRenderer.on('app:open-files', subscription)
    return () => ipcRenderer.off('app:open-files', subscription)
  },

  // ==========================================
  // Диалог при выходе / закрытии вкладки
  // ==========================================

  /** Диалог подтверждения выхода с несохранёнными файлами */
  confirmExit: (fileNames: string[]): Promise<'save' | 'discard' | 'cancel'> => {
    return ipcRenderer.invoke('dialog:confirmExit', fileNames)
  },

  /** Подписка на событие попытки закрытия окна */
  onBeforeClose: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on('window:before-close', subscription)
    return () => ipcRenderer.off('window:before-close', subscription)
  },

  /** Подтвердить закрытие окна (разрешить) */
  confirmClose: () => {
    ipcRenderer.send('window:confirm-close')
  },

  // ==========================================
  // Масштаб интерфейса (Ctrl+=/Ctrl+-)
  // ==========================================

  /** Увеличить масштаб интерфейса */
  zoomIn: () => {
    webFrame.setZoomLevel(webFrame.getZoomLevel() + 0.5)
    return Math.round(webFrame.getZoomFactor() * 100)
  },

  /** Уменьшить масштаб интерфейса */
  zoomOut: () => {
    webFrame.setZoomLevel(webFrame.getZoomLevel() - 0.5)
    return Math.round(webFrame.getZoomFactor() * 100)
  },

  /** Сбросить масштаб интерфейса */
  zoomReset: () => {
    webFrame.setZoomLevel(0)
    return 100
  },

  // ==========================================
  // Темы оформления и редактор тем
  // ==========================================

  /** Получить сохраненные пользовательские темы */
  getCustomThemes: (): Promise<any[]> => {
    return ipcRenderer.invoke('theme:getCustomThemes')
  },

  /** Сохранить пользовательскую тему */
  saveCustomTheme: (theme: any): Promise<boolean> => {
    return ipcRenderer.invoke('theme:saveCustomTheme', theme)
  },

  /** Удалить пользовательскую тему */
  deleteCustomTheme: (themeId: string): Promise<boolean> => {
    return ipcRenderer.invoke('theme:deleteCustomTheme', themeId)
  },

  /** Экспорт темы в JSON файл */
  exportTheme: (theme: any): Promise<boolean> => {
    return ipcRenderer.invoke('theme:exportTheme', theme)
  },

  /** Импорт тем из JSON файла */
  importThemes: (): Promise<any[] | null> => {
    return ipcRenderer.invoke('theme:importThemes')
  },
})
