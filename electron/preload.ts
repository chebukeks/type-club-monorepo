import { ipcRenderer, contextBridge } from 'electron'

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
})
