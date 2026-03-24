import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

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
