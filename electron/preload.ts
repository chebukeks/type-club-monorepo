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

  /** Экспорт в HTML (откроет диалог сохранения) */
  exportHtml: (content: string, defaultName: string) => {
    return ipcRenderer.invoke('export:html', content, defaultName)
  },

  /** Экспорт в PDF (откроет диалог сохранения) */
  exportPdf: (htmlContent: string, defaultName: string) => {
    return ipcRenderer.invoke('export:pdf', htmlContent, defaultName)
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
})
