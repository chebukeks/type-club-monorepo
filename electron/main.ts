import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import Store from 'electron-store'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Хранилище настроек приложения */
const store = new Store({
  defaults: {
    theme: 'dark',
    autosave: true,
    spellcheck: true,
    showStats: true,
  },
})

/** Пути к файлам, переданные через командную строку при старте */
const initialFiles: string[] = []

/**
 * Извлекает пути к существующим .md файлам из аргументов командной строки.
 */
function getFilesFromArgs(argv: string[]): string[] {
  return argv.filter(arg => {
    // Пропускаем флаги и сам путь к исполняемому файлу/точке входа
    if (arg.startsWith('-')) return false
    if (!arg.endsWith('.md')) return false
    try {
      return fs.existsSync(arg) && fs.statSync(arg).isFile()
    } catch {
      return false
    }
  })
}

// Первичный сбор файлов при запуске
initialFiles.push(...getFilesFromArgs(process.argv))
console.log('[MAIN] initialFiles from argv:', initialFiles)

// ============================================================
// Проверка на единственность экземпляра приложения
// ============================================================
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  // Дебаунс-очередь: при открытии N файлов из проводника Windows запускает
  // N экземпляров приложения, каждый из которых шлёт second-instance.
  // Собираем все файлы в очередь и отправляем одним IPC-сообщением.
  let pendingFiles: string[] = []
  let flushTimer: ReturnType<typeof setTimeout> | null = null

  function flushPendingFiles() {
    flushTimer = null
    if (pendingFiles.length === 0 || !win) return
    const batch = pendingFiles.splice(0)
    console.log('[MAIN] flushing batch:', batch.length, 'files')

    if (win.webContents.isLoading()) {
      win.webContents.once('did-finish-load', () => {
        win!.webContents.send('app:open-files', batch)
      })
    } else {
      win.webContents.send('app:open-files', batch)
    }
  }

  app.on('second-instance', (_event, commandLine) => {
    const additionalFiles = getFilesFromArgs(commandLine)
    console.log('[MAIN] second-instance, win:', !!win, 'files:', additionalFiles)

    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }

    if (additionalFiles.length === 0) return

    if (!win) {
      // Окно ещё не создано — renderer заберёт через app:get-files-to-open
      initialFiles.push(...additionalFiles)
      return
    }

    // Копим файлы и сбрасываем таймер дебаунса
    pendingFiles.push(...additionalFiles)
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = setTimeout(flushPendingFiles, 150)
  })
}

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
/** Флаг: разрешено ли закрытие окна (после подтверждения renderer) */
let allowClose = false

// ============================================================
// Создание главного окна приложения
// ============================================================
function createWindow() {
  // Восстановление размеров и положения окна из хранилища
  const savedBounds = store.get('windowBounds') as { x?: number; y?: number; width?: number; height?: number; isMaximized?: boolean } | undefined

  win = new BrowserWindow({
    width: savedBounds?.width || 1200,
    height: savedBounds?.height || 800,
    ...(savedBounds?.x !== undefined && savedBounds?.y !== undefined ? { x: savedBounds.x, y: savedBounds.y } : {}),
    minWidth: 800,
    minHeight: 500,
    frame: false,                     // Убираем системную рамку
    titleBarStyle: 'hidden',          // Скрываем заголовок
    icon: path.join(process.env.APP_ROOT, 'build',
      process.platform === 'win32' ? 'icon.ico'
        : process.platform === 'darwin' ? 'icon.icns'
          : path.join('icons', 'icon.png')),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,         // Изоляция контекста (безопасность)
      nodeIntegration: false,         // Запрет прямого доступа к Node.js
      spellcheck: store.get('spellcheck', true) as boolean,
    },
  })

  // Восстанавливаем полноэкранный режим
  if (savedBounds?.isMaximized) {
    win.maximize()
  }

  // --- Сохранение размеров окна с debounce ---
  let boundsTimer: ReturnType<typeof setTimeout> | null = null
  function saveBounds() {
    if (!win) return
    if (boundsTimer) clearTimeout(boundsTimer)
    boundsTimer = setTimeout(() => {
      if (!win) return
      const isMaximized = win.isMaximized()
      if (!isMaximized) {
        const bounds = win.getBounds()
        store.set('windowBounds', { ...bounds, isMaximized: false })
      } else {
        // Сохраняем только флаг максимизации, остальное оставляем как есть
        const prev = store.get('windowBounds') as Record<string, unknown> | undefined
        store.set('windowBounds', { ...(prev || {}), isMaximized: true })
      }
    }, 500)
  }
  win.on('resize', saveBounds)
  win.on('move', saveBounds)
  win.on('maximize', saveBounds)
  win.on('unmaximize', saveBounds)

  // --- Перехват закрытия окна (диалог при несохранённых файлах) ---
  win.on('close', (e) => {
    if (!allowClose && win) {
      e.preventDefault()
      win.webContents.send('window:before-close')
    }
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // Запрещаем создавать новые окна через target="_blank" или window.open
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Запрещаем навигацию основного окна по внешним ссылкам
  win.webContents.on('will-navigate', (event, url) => {
    // В dev режиме разрешаем навигацию по localhost (HMR, релоады и т.д.)
    if (VITE_DEV_SERVER_URL && url.startsWith(VITE_DEV_SERVER_URL)) return
    
    // В проде разрешаем навигацию по index.html
    const isLocalFile = url.startsWith('file:') && url.includes('index.html')
    if (isLocalFile) return

    // Все остальные навигации (например youtube.com) блокируем и открываем в браузере
    event.preventDefault()
    shell.openExternal(url)
  })
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
        result.push({
          name: entry.name,
          path: fullPath,
          isDirectory: true,
          children,
        })
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

// --- Создание директории ---
ipcMain.handle('fs:createDir', async (_event, dirPath: string): Promise<void> => {
  fs.mkdirSync(dirPath, { recursive: true })
})

// --- Переименование ---
ipcMain.handle('fs:rename', async (_event, oldPath: string, newPath: string): Promise<void> => {
  fs.renameSync(oldPath, newPath)
})

// --- Удаление (в корзину) ---
ipcMain.handle('fs:delete', async (_event, filePath: string): Promise<void> => {
  await shell.trashItem(filePath)
})

// --- Показать в проводнике ---
ipcMain.on('shell:showItemInFolder', (_event, filePath: string) => {
  shell.showItemInFolder(filePath)
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

// --- Диалог: сохранить как... ---
ipcMain.handle('dialog:saveFileAs', async (_event, content: string, defaultName: string): Promise<{ filePath: string } | null> => {
  const result = await dialog.showSaveDialog(win!, {
    title: 'Сохранить как...',
    defaultPath: defaultName,
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  })
  if (result.canceled || !result.filePath) return null

  try {
    fs.writeFileSync(result.filePath, content, 'utf-8')
    return { filePath: result.filePath }
  } catch (err) {
    console.error('Ошибка сохранения файла:', err)
    return null
  }
})

// --- Диалог: подтверждение удаления ---
ipcMain.handle('dialog:confirmDelete', async (_event, itemName: string): Promise<boolean> => {
  const result = await dialog.showMessageBox(win!, {
    type: 'warning',
    buttons: ['Удалить', 'Отмена'],
    defaultId: 1,
    cancelId: 1,
    title: 'Подтверждение удаления',
    message: `Вы действительно хотите удалить '${itemName}'?`,
    detail: 'Файл или папка будет перемещен в корзину.'
  })
  return result.response === 0
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
// IPC-хэндлеры для хранилища настроек (electron-store)
// ============================================================
ipcMain.handle('store:get', async (_event, key: string) => {
  return store.get(key)
})

ipcMain.handle('store:set', async (_event, key: string, value: unknown) => {
  store.set(key as string, value)
})

// ============================================================
// IPC-хэндлеры для спеллчекера
// ============================================================

/** Включить/выключить проверку орфографии */
ipcMain.handle('spellcheck:set', async (_event, enabled: boolean) => {
  if (win) {
    win.webContents.session.setSpellCheckerEnabled(enabled)
  }
  store.set('spellcheck', enabled)
})

/** Получить текущее состояние спеллчекера */
ipcMain.handle('spellcheck:get', async () => {
  return store.get('spellcheck', true) as boolean
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
ipcMain.on('window:openExternal', (_event, url: string) => shell.openExternal(url))

// Подтверждение закрытия окна от renderer
ipcMain.on('window:confirm-close', () => {
  allowClose = true
  win?.close()
})

// ============================================================
// IPC-хэндлеры для открытия файлов при старте
// ============================================================
ipcMain.handle('app:get-files-to-open', () => {
  return initialFiles
})

// ============================================================
// Диалог подтверждения выхода с несохранёнными файлами
// ============================================================
ipcMain.handle('dialog:confirmExit', async (_event, fileNames: string[]): Promise<'save' | 'discard' | 'cancel'> => {
  const fileList = fileNames.join('\n')
  const result = await dialog.showMessageBox(win!, {
    type: 'warning',
    buttons: ['Сохранить', 'Без сохранения', 'Отмена'],
    defaultId: 0,
    cancelId: 2,
    title: 'Несохранённые изменения',
    message: 'У вас есть несохранённые изменения:',
    detail: fileList,
  })
  if (result.response === 0) return 'save'
  if (result.response === 1) return 'discard'
  return 'cancel'
})

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
