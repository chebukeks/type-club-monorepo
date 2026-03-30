import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Структура сборки:
 * ├─┬─ dist/          — собранный фронтенд
 * │ └── index.html
 * ├─┬─ dist-electron/ — собранный Electron
 * │ ├── main.js
 * │ └── preload.mjs
 */
process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null

// ============================================================
// Создание главного окна приложения
// ============================================================
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    frame: false,                     // Убираем системную рамку
    titleBarStyle: 'hidden',          // Скрываем заголовок
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,         // Изоляция контекста (безопасность)
      nodeIntegration: false,         // Запрет прямого доступа к Node.js
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// ============================================================
// IPC-хэндлеры для работы с файловой системой
// ============================================================

/** Интерфейс элемента файлового дерева */
interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  children?: FileEntry[]
}

/**
 * Рекурсивное чтение директории.
 * Возвращает дерево файлов/папок, фильтруя только .md файлы и папки.
 */
function readDirRecursive(dirPath: string): FileEntry[] {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    const result: FileEntry[] = []

    for (const entry of entries) {
      // Пропускаем скрытые файлы и node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

      const fullPath = path.join(dirPath, entry.name)

      if (entry.isDirectory()) {
        const children = readDirRecursive(fullPath)
        // Показываем папку, только если в ней есть .md файлы
        if (children.length > 0) {
          result.push({
            name: entry.name,
            path: fullPath,
            isDirectory: true,
            children,
          })
        }
      } else if (entry.name.endsWith('.md')) {
        result.push({
          name: entry.name,
          path: fullPath,
          isDirectory: false,
        })
      }
    }

    // Сортировка: папки сверху, затем файлы, алфавитно
    return result.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.name.localeCompare(b.name)
    })
  } catch {
    return []
  }
}

// --- Чтение файла ---
ipcMain.handle('fs:readFile', async (_event, filePath: string): Promise<string> => {
  return fs.readFileSync(filePath, 'utf-8')
})

// --- Запись файла ---
ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string): Promise<void> => {
  fs.writeFileSync(filePath, content, 'utf-8')
})

// --- Чтение директории (рекурсивно) ---
ipcMain.handle('fs:readDir', async (_event, dirPath: string): Promise<FileEntry[]> => {
  return readDirRecursive(dirPath)
})

// --- Диалог: открыть папку ---
ipcMain.handle('dialog:openFolder', async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Выберите рабочую папку',
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

// --- Диалог: открыть файл ---
ipcMain.handle('dialog:openFile', async (): Promise<{ filePath: string; content: string } | null> => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md'] }],
    title: 'Открыть Markdown-файл',
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  const content = fs.readFileSync(filePath, 'utf-8')
  return { filePath, content }
})

// --- Экспорт в HTML ---
ipcMain.handle('export:html', async (_event, htmlContent: string, defaultName: string): Promise<boolean> => {
  const result = await dialog.showSaveDialog(win!, {
    title: 'Экспорт в HTML',
    defaultPath: defaultName,
    filters: [{ name: 'HTML Document', extensions: ['html'] }]
  })
  
  if (result.canceled || !result.filePath) return false
  
  try {
    fs.writeFileSync(result.filePath, htmlContent, 'utf-8')
    return true
  } catch (err) {
    console.error('Ошибка экспорта HTML:', err)
    return false
  }
})

// --- Экспорт в PDF ---
ipcMain.handle('export:pdf', async (_event, htmlContent: string, defaultName: string): Promise<boolean> => {
  const result = await dialog.showSaveDialog(win!, {
    title: 'Экспорт в PDF',
    defaultPath: defaultName,
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
  })
  
  if (result.canceled || !result.filePath) return false
  
  try {
    // Создаем скрытое окно для рендеринга PDF
    const printWin = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })
    // Создаем временный файл, чтобы Chromium мог корректно загрузить внешние ресурсы (CSS/Fonts)
    // Data URI блокирует загрузку шрифтов из-за строгой политики безопасности (CORS/Opaque Origin)
    const tempHtmlPath = path.join(os.tmpdir(), `type_club_export_${Date.now()}.html`)
    fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8')
    
    // Загружаем сохраненный HTML файл с диска
    await printWin.loadURL(`file://${tempHtmlPath}`)
    
    // ДОЖИДАЕМСЯ загрузки всех веб-шрифтов KaTeX (чтобы формулы не были "скукоженными")
    await printWin.webContents.executeJavaScript('document.fonts.ready')
    // Небольшая доп. пауза на всякий случай для применения CSS
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Генерация PDF (Chromium может подождать небольшой таймаут для загрузки шрифтов)
    const pdfBuffer = await printWin.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { marginType: 'default' }
    })
    
    // Сохраняем финальный PDF в выбранное пользователем место и чистим временный файл
    fs.writeFileSync(result.filePath, pdfBuffer)
    fs.unlinkSync(tempHtmlPath)
    printWin.close()
    
    return true
  } catch (err) {
    console.error('Ошибка экспорта PDF:', err)
    return false
  }
})

// ============================================================
// IPC-хэндлеры для управления окном
// ============================================================
ipcMain.on('window:minimize', () => win?.minimize())
ipcMain.on('window:maximize', () => {
  if (win?.isMaximized()) {
    win.unmaximize()
  } else {
    win?.maximize()
  }
})
ipcMain.on('window:close', () => win?.close())

// ============================================================
// Жизненный цикл приложения
// ============================================================
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
