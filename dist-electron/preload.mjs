"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  // ==========================================
  // Файловая система
  // ==========================================
  /** Чтение содержимого .md файла */
  readFile: (filePath) => {
    return electron.ipcRenderer.invoke("fs:readFile", filePath);
  },
  /** Сохранение содержимого в файл */
  writeFile: (filePath, content) => {
    return electron.ipcRenderer.invoke("fs:writeFile", filePath, content);
  },
  /** Получение дерева файлов в директории */
  readDir: (dirPath) => {
    return electron.ipcRenderer.invoke("fs:readDir", dirPath);
  },
  // ==========================================
  // Диалоговые окна
  // ==========================================
  /** Открыть диалог выбора папки */
  openFolder: () => {
    return electron.ipcRenderer.invoke("dialog:openFolder");
  },
  /** Открыть диалог выбора .md файла */
  openFile: () => {
    return electron.ipcRenderer.invoke("dialog:openFile");
  },
  /** Экспорт в HTML (откроет диалог сохранения) */
  exportHtml: (content, defaultName) => {
    return electron.ipcRenderer.invoke("export:html", content, defaultName);
  },
  /** Экспорт в PDF (откроет диалог сохранения) */
  exportPdf: (htmlContent, defaultName) => {
    return electron.ipcRenderer.invoke("export:pdf", htmlContent, defaultName);
  },
  // ==========================================
  // Управление окном (frameless window)
  // ==========================================
  /** Свернуть окно */
  minimizeWindow: () => electron.ipcRenderer.send("window:minimize"),
  /** Развернуть/восстановить окно */
  maximizeWindow: () => electron.ipcRenderer.send("window:maximize"),
  /** Закрыть окно */
  closeWindow: () => electron.ipcRenderer.send("window:close")
});
