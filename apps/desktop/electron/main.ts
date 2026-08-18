import { app, BrowserWindow, ipcMain, dialog, shell, screen, clipboard } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import Store from 'electron-store'
import nspell from 'nspell'
import dictRu from 'dictionary-ru'
import dictEn from 'dictionary-en'

// Используем встроенный оффлайн Hunspell вместо Windows Native Spellchecker.
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-features', 'WinUseBrowserSpellChecker')
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

import { createRequire } from 'node:module'
import { MODERN_WORDS, RUSSIAN_PRODUCTIVE_PREFIXES, RUSSIAN_NOUN_SUFFIXES } from './modernWords'

const esmRequire = createRequire(import.meta.url)
let englishWordsSet = new Set<string>()

try {
  const englishArray = esmRequire('an-array-of-english-words')
  if (Array.isArray(englishArray)) {
    englishWordsSet = new Set(englishArray)
  }
} catch (err) {
  console.error('[SPELLCHECK] Error loading extended english wordlist:', err)
}

// Локальный спеллчекер (0ms latency, оффлайн)
let spellRu: any = null
let spellEn: any = null
const customWordsSet = new Set<string>()

function initSpellchecker() {
  try {
    spellRu = nspell(dictRu)
    spellEn = nspell(dictEn)
    customWordsSet.clear()

    // Добавляем расширенный словарь терминов
    for (const w of MODERN_WORDS) {
      if (spellRu) spellRu.add(w)
      if (spellEn) spellEn.add(w)
    }

    const stored = (store.get('customDictionaryWords', []) as string[]) || []
    for (const w of stored) {
      const clean = w.trim().toLowerCase()
      if (clean) {
        customWordsSet.add(clean)
        if (spellRu) spellRu.add(clean)
        if (spellEn) spellEn.add(clean)
      }
    }
  } catch (err) {
    console.error('[SPELLCHECK] Error initializing spellchecker in main:', err)
  }
}

function isWordValidInternal(word: string, checkRu: boolean, checkEn: boolean): boolean {
  if (!word) return true
  if (word.length <= 1) return true
  const lower = word.toLowerCase()

  if (customWordsSet.has(lower)) return true

  // 1. Проверка по полному расширенному словарю английского языка SCOWL (275 000 слов)
  if (checkEn && (englishWordsSet.has(lower) || englishWordsSet.has(word))) return true

  // 2. Проверка прямого написания и в нижнем регистре по Hunspell
  if (checkRu && spellRu) {
    if (spellRu.correct(word) || spellRu.correct(lower)) return true
  }
  if (checkEn && spellEn) {
    if (spellEn.correct(word) || spellEn.correct(lower)) return true
  }

  // 3. Проверка отвлеченных существительных от прилагательных (-ость, -ости, -остью)
  if (checkRu && spellRu) {
    for (const [ending, adjEnding] of RUSSIAN_NOUN_SUFFIXES) {
      if (lower.endsWith(ending)) {
        const stem = lower.slice(0, -ending.length)
        if (
          spellRu.correct(stem + adjEnding) ||
          spellRu.correct(stem + 'ный') ||
          spellRu.correct(stem + 'нный') ||
          spellRu.correct(stem + 'ий')
        ) {
          return true
        }
      }
    }
  }

  // 4. Проверка продуктивных приставок сложных слов (нейро-, меж-, микро-, поли-, etc.)
  if (checkRu) {
    for (const p of RUSSIAN_PRODUCTIVE_PREFIXES) {
      if (lower.startsWith(p)) {
        const rest = lower.slice(p.length)
        if (rest.length >= 3 && isWordValidInternal(rest, checkRu, checkEn)) {
          return true
        }
      }
    }
  }

  // 5. Проверка сложных слов с соединительными гласными 'о' и 'е' (церковнославянский, иконографика)
  if (checkRu && spellRu && lower.length >= 8) {
    for (let i = 3; i <= lower.length - 4; i++) {
      const char = lower[i]
      if (char === 'о' || char === 'е') {
        const stem1 = lower.slice(0, i)
        const stem2 = lower.slice(i + 1)
        const stem1Valid =
          spellRu.correct(stem1) ||
          spellRu.correct(stem1 + 'ый') ||
          spellRu.correct(stem1 + 'ий') ||
          spellRu.correct(stem1 + 'а') ||
          spellRu.correct(stem1 + 'ь') ||
          spellRu.correct(stem1 + 'о') ||
          spellRu.correct(stem1 + 'ный')
        if (stem1Valid && isWordValidInternal(stem2, checkRu, checkEn)) {
          return true
        }
      }
    }
  }

  // 6. Проверка русских дефисных слов (какой-то, из-за, по-русски, во-первых, всё-таки, Санкт-Петербург)
  if (word.includes('-')) {
    const parts = word.split('-')
    const particles = ['то', 'либо', 'нибудь', 'ка', 'де', 'таки', 'с']

    // Суффиксальные частицы (-то, -либо, -нибудь, -ка, -де, -таки, -с)
    if (parts.length === 2 && particles.includes(parts[1].toLowerCase())) {
      if (isWordValidInternal(parts[0], checkRu, checkEn)) return true
    }

    // Префиксальные частицы (кое-, кой-)
    if (parts.length === 2 && (parts[0].toLowerCase() === 'кое' || parts[0].toLowerCase() === 'кой')) {
      if (isWordValidInternal(parts[1], checkRu, checkEn)) return true
    }

    // Приставка по- (по-русски, по-моему, по-прежнему)
    if (parts.length === 2 && parts[0].toLowerCase() === 'по') {
      const base = parts[1]
      if (
        isWordValidInternal(base, checkRu, checkEn) ||
        isWordValidInternal(base + 'й', checkRu, checkEn) ||
        isWordValidInternal(base + 'ый', checkRu, checkEn)
      ) {
        return true
      }
    }

    if (lower === 'из-за' || lower === 'из-под' || lower === 'всё-таки' || lower === 'все-таки') return true

    // Проверка составных слов через дефис: если обе части валидны, всё слово валидно
    if (parts.every((p) => p.length > 0 && isWordValidInternal(p, checkRu, checkEn))) {
      return true
    }
  }

  return false
}

function checkWordMisspelled(rawWord: string): boolean {
  if (!rawWord) return false
  const word = rawWord.trim()
  if (word.length <= 1) return false

  // 1. Игнорируем числа, спецсимволы, пути файлов, переменные и разметку
  if (/\d/.test(word) || /[._/\\:@#%&*~^|<>=+$]/.test(word)) return false
  if (/^[\d_#*`~+\-=\\/$@%^&()\[\]{}|<>]+$/.test(word)) return false

  // 2. Акронимы и аббревиатуры из заглавных букв (API, JSON, HTTP, URL, CSS, HTML, UI, UX, TS, JS, ID, AI, IT, PDF, SQL)
  if (/^[\p{Lu}]{2,}$/u.test(word)) {
    return false
  }

  // 3. Верблюжий регистр / идентификаторы (TypeScript, JavaScript, GitHub, VSCode, KaTeX, OpenAI, MarkdownEditor)
  if (/[a-z][A-Z]/.test(word) || /[а-яА-Яa-zA-Z][A-Z]/.test(word)) {
    return false
  }

  const enabledLangs = (store.get('spellcheckLanguages', ['ru-RU', 'en-US']) as string[]) || ['ru-RU', 'en-US']
  const checkRu = enabledLangs.some((l) => l.toLowerCase().startsWith('ru'))
  const checkEn = enabledLangs.some((l) => l.toLowerCase().startsWith('en'))

  const isCorrect = isWordValidInternal(word, checkRu, checkEn)
  return !isCorrect
}

function getWordSuggestions(rawWord: string): string[] {
  const clean = rawWord.trim().toLowerCase()
  if (!clean) return []

  const enabledLangs = (store.get('spellcheckLanguages', ['ru-RU', 'en-US']) as string[]) || ['ru-RU', 'en-US']
  const checkRu = enabledLangs.some((l) => l.toLowerCase().startsWith('ru'))
  const checkEn = enabledLangs.some((l) => l.toLowerCase().startsWith('en'))

  const isCyrillic = /[\u0400-\u04FF]/u.test(clean)
  const isLatin = /[a-zA-Z]/.test(clean)

  const suggestions: string[] = []
  if (isCyrillic && checkRu && spellRu) {
    try {
      suggestions.push(...spellRu.suggest(clean))
    } catch { /* ignore */ }
  } else if (isLatin && checkEn && spellEn) {
    try {
      suggestions.push(...spellEn.suggest(clean))
    } catch { /* ignore */ }
  } else {
    if (checkRu && spellRu) {
      try { suggestions.push(...spellRu.suggest(clean)) } catch { /* ignore */ }
    }
    if (checkEn && spellEn) {
      try { suggestions.push(...spellEn.suggest(clean)) } catch { /* ignore */ }
    }
  }

  return Array.from(new Set(suggestions)).slice(0, 5)
}

/** Проверка и копирование встроенных словарей в папку пользователя */
function ensureDictionaries() {
  try {
    const userData = app.getPath('userData')
    const dictDir = path.join(userData, 'Dictionaries')
    if (!fs.existsSync(dictDir)) {
      fs.mkdirSync(dictDir, { recursive: true })
    }

    const resourcesDir = app.isPackaged
      ? path.join(process.resourcesPath, 'resources', 'dictionaries')
      : path.join(__dirname, '..', 'resources', 'dictionaries')

    if (fs.existsSync(resourcesDir)) {
      const files = fs.readdirSync(resourcesDir)
      for (const file of files) {
        if (file.endsWith('.bdic')) {
          const dest = path.join(dictDir, file)
          if (!fs.existsSync(dest) || fs.statSync(dest).size === 0) {
            fs.copyFileSync(path.join(resourcesDir, file), dest)
          }
        }
      }
    }
  } catch (err) {
    console.error('[SPELLCHECK] Error ensuring dictionaries:', err)
  }
}

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

/** Применить список языков для спеллчекера */
function applySpellCheckerLanguages(targetLangs: string[]) {
  if (!win) return
  try {
    ensureDictionaries()
    win.webContents.session.setSpellCheckerLanguages(targetLangs)
  } catch (e) {
    console.error('Failed to set spellchecker languages:', e)
  }
}

// ============================================================
// Создание главного окна приложения
// ============================================================
function createWindow() {
  // Восстановление размеров и положения окна из хранилища
  const savedBounds = store.get('windowBounds') as { x?: number; y?: number; width?: number; height?: number; isMaximized?: boolean } | undefined

  // Получаем область всех дисплеев для проверки координат
  const displays = screen.getAllDisplays()
  const boundsInDisplay = savedBounds?.x !== undefined ? displays.some((display: any) => {
    return (
      savedBounds.x! >= display.bounds.x &&
      savedBounds.y! >= display.bounds.y &&
      savedBounds.x! < display.bounds.x + display.bounds.width &&
      savedBounds.y! < display.bounds.y + display.bounds.height
    )
  }) : false

  // Ключевой фикс для мульти-мониторного DPI в Electron на Windows:
  // 1. Мы передаем в конструктор ТОЛЬКО x и y (при условии, что они валидны). 
  // Это гарантирует, что нативный HWND изначально будет создан на целевом мониторе, в его родном DPI контексте.
  // 2. Мы НЕ передаем width и height, иначе Windows применит масшаб главного монитора (на котором был запущен процесс).
  const opts: any = {
    minWidth: 800,
    minHeight: 500,
    show: false,                      // Скрываем окно до применения координат
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
      spellcheck: false,              // Отключаем встроенный спеллчекер Chromium (используем кастомный PM-плагин)
    },
  }

  if (boundsInDisplay) {
    opts.x = savedBounds!.x
    opts.y = savedBounds!.y
  } else {
    // Дефолтные размеры при создании по центру главного экрана, если сохраненных нет или они битые
    opts.width = savedBounds?.width || 1200
    opts.height = savedBounds?.height || 800
  }

  win = new BrowserWindow(opts)

  // 3. Теперь, когда окно ИЗНАЧАЛЬНО привязано к правильному монитору (если координаты были валидны),
  // мы применяем к нему width и height. Так как DPI контекст уже верен,
  // Windows не будет пытаться "скэйлить" эти логические пиксели при переброске окна.
  if (boundsInDisplay && savedBounds?.width && savedBounds?.height) {
    win.setSize(savedBounds.width, savedBounds.height)
  } else if (!boundsInDisplay) {
    win.center()
  }

  win.once('ready-to-show', () => {
    // Восстанавливаем полноэкранный режим
    if (savedBounds?.isMaximized) {
      win!.maximize()
    }
    win!.show()
  })

  // Разрешаем открытие DevTools по F12 или Ctrl+Shift+I для отладки
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
        event.preventDefault()
        win?.webContents.toggleDevTools()
      }
    }
  })

  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[MAIN] Render process gone (crashed):', details)
  })
  win.webContents.on('unresponsive', () => {
    console.warn('[MAIN] Window unresponsive')
  })
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      console.log(`[RENDERER ERROR] ${message} (${sourceId}:${line})`)
    }
  })

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

  // Инициализация локального спеллчекера nspell
  initSpellchecker()

  // Настройка языков спеллчекера и пользовательских слов
  const enabledSpellcheckLangs = (store.get('spellcheckLanguages', ['ru-RU', 'en-US']) as string[]) || ['ru-RU', 'en-US']
  applySpellCheckerLanguages(enabledSpellcheckLangs)

  const customWords = (store.get('customDictionaryWords', []) as string[]) || []
  for (const word of customWords) {
    try {
      win.webContents.session.addWordToSpellCheckerDictionary(word)
    } catch { /* ignore */ }
  }

  // Перехват контекстного меню спеллчекера для отправки слова с ошибкой и вариантов в renderer
  win.webContents.on('context-menu', (_event, params) => {
    win?.webContents.send('context-menu-info', {
      misspelledWord: params.misspelledWord || '',
      dictionarySuggestions: params.dictionarySuggestions || [],
      x: params.x,
      y: params.y,
    })
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

// --- Проверка существования ---
ipcMain.handle('fs:exists', async (_event, filePath: string): Promise<boolean> => {
  try {
    return fs.existsSync(filePath)
  } catch {
    return false
  }
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

// --- Копирование файла в системный буфер обмена как файла ---
ipcMain.handle('clipboard:copyFile', async (_event, filePath: string): Promise<boolean> => {
  try {
    const normalizedPath = path.resolve(filePath)
    if (!fs.existsSync(normalizedPath)) {
      return false
    }

    if (process.platform === 'win32') {
      // DROPFILES struct для Windows (CF_HDROP):
      // DWORD pFiles = 20 (смещение до списка файлов)
      // POINT pt = {0, 0} (8 байт)
      // BOOL fNC = 0 (4 байта)
      // BOOL fWide = 1 (4 байта, признак UTF-16LE)
      const header = Buffer.alloc(20)
      header.writeUInt32LE(20, 0) // pFiles
      header.writeUInt32LE(0, 4)  // pt.x
      header.writeUInt32LE(0, 8)  // pt.y
      header.writeUInt32LE(0, 12) // fNC
      header.writeUInt32LE(1, 16) // fWide

      // Список файлов в формате двойного null-terminator UTF-16LE: "path\0\0"
      const fileListBuffer = Buffer.from(normalizedPath + '\0\0', 'ucs2')
      const hDropBuffer = Buffer.concat([header, fileListBuffer])

      clipboard.writeBuffer('CF_HDROP', hDropBuffer)
      clipboard.writeBuffer('FileNameW', Buffer.from(normalizedPath + '\0', 'ucs2'))
      clipboard.writeText(normalizedPath)
    } else if (process.platform === 'darwin') {
      const plist = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><array><string>${normalizedPath}</string></array></plist>`
      clipboard.writeBuffer('NSFilenamesPboardType', Buffer.from(plist, 'utf8'))
      clipboard.writeText(normalizedPath)
    } else {
      // Linux
      const uri = `file://${encodeURI(normalizedPath)}`
      clipboard.writeBuffer('text/uri-list', Buffer.from(`${uri}\r\n`, 'utf8'))
      clipboard.writeBuffer('x-special/gnome-copied-files', Buffer.from(`copy\n${uri}\r\n`, 'utf8'))
      clipboard.writeText(normalizedPath)
    }
    return true
  } catch (err) {
    console.error('Ошибка копирования файла в буфер обмена:', err)
    return false
  }
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
      margins: { marginType: 'none' },
      generateDocumentOutline: true
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

/** Получить активные языки проверки орфографии */
ipcMain.handle('spellcheck:getLanguages', async () => {
  return (store.get('spellcheckLanguages', ['ru-RU', 'en-US']) as string[]) || ['ru-RU', 'en-US']
})

/** Установить активные языки проверки орфографии */
ipcMain.handle('spellcheck:setLanguages', async (_event, languages: string[]) => {
  applySpellCheckerLanguages(languages)
  store.set('spellcheckLanguages', languages)
  return true
})

/** Получить список пользовательских слов */
ipcMain.handle('spellcheck:getCustomWords', async () => {
  return (store.get('customDictionaryWords', []) as string[]) || []
})

/** Проверить, считается ли слово ошибочным */
ipcMain.handle('spellcheck:isMisspelled', async (_event, word: string) => {
  return checkWordMisspelled(word)
})

/** Получить варианты исправлений для слова */
ipcMain.handle('spellcheck:getSuggestions', async (_event, word: string) => {
  return getWordSuggestions(word)
})

/** Пакетная проверка списка слов */
ipcMain.handle('spellcheck:checkWords', async (_event, words: string[]) => {
  if (!Array.isArray(words)) return []
  return words.filter((w) => checkWordMisspelled(w))
})

/** Добавить слово в пользовательский словарь */
ipcMain.handle('spellcheck:addCustomWord', async (_event, word: string) => {
  const trimmed = word.trim()
  if (!trimmed) return false
  const lower = trimmed.toLowerCase()
  customWordsSet.add(lower)
  if (spellRu) spellRu.add(lower)
  if (spellEn) spellEn.add(lower)

  const current = (store.get('customDictionaryWords', []) as string[]) || []
  if (!current.some((w) => w.toLowerCase() === lower)) {
    current.push(trimmed)
    store.set('customDictionaryWords', current)
  }
  if (win) {
    try {
      win.webContents.session.addWordToSpellCheckerDictionary(trimmed)
    } catch (e) {
      console.error('Failed to add word to spellchecker dictionary:', e)
    }
  }
  return true
})

/** Удалить слово из пользовательского словаря */
ipcMain.handle('spellcheck:removeCustomWord', async (_event, word: string) => {
  const lower = word.trim().toLowerCase()
  customWordsSet.delete(lower)
  const current = (store.get('customDictionaryWords', []) as string[]) || []
  const filtered = current.filter((w) => w.toLowerCase() !== lower)
  store.set('customDictionaryWords', filtered)
  initSpellchecker()
  if (win) {
    try {
      win.webContents.session.removeWordFromSpellCheckerDictionary(word)
    } catch {
      /* ignore */
    }
  }
  return true
})

// ============================================================
// IPC-хэндлеры для работы с темами оформления
// ============================================================

/** Получить список сохраненных пользовательских тем */
ipcMain.handle('theme:getCustomThemes', async () => {
  return (store.get('customThemes', []) as any[]) || []
})

/** Сохранить или обновить пользовательскую тему */
ipcMain.handle('theme:saveCustomTheme', async (_event, theme: any) => {
  if (!theme || !theme.id || !theme.name) return false
  const customThemes = (store.get('customThemes', []) as any[]) || []
  const index = customThemes.findIndex((t: any) => t.id === theme.id)
  if (index >= 0) {
    customThemes[index] = { ...theme, isBuiltin: false }
  } else {
    customThemes.push({ ...theme, isBuiltin: false })
  }
  store.set('customThemes', customThemes)
  return true
})

/** Удалить пользовательскую тему */
ipcMain.handle('theme:deleteCustomTheme', async (_event, themeId: string) => {
  if (!themeId) return false
  const customThemes = (store.get('customThemes', []) as any[]) || []
  const filtered = customThemes.filter((t: any) => t.id !== themeId)
  store.set('customThemes', filtered)
  return true
})

/** Экспорт темы в JSON файл */
ipcMain.handle('theme:exportTheme', async (_event, theme: any) => {
  if (!win || !theme) return false
  const defaultName = `${theme.name || 'theme'}.typeclub-theme.json`
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Экспорт темы',
    defaultPath: defaultName,
    filters: [
      { name: 'Type Club Theme (*.json)', extensions: ['json'] },
      { name: 'Все файлы (*.*)', extensions: ['*'] },
    ],
  })

  if (canceled || !filePath) return false

  try {
    const jsonStr = JSON.stringify(theme, null, 2)
    await fs.promises.writeFile(filePath, jsonStr, 'utf-8')
    return true
  } catch (err) {
    console.error('Failed to export theme:', err)
    return false
  }
})

/** Импорт тем из JSON файла */
ipcMain.handle('theme:importThemes', async () => {
  if (!win) return null
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Импорт тем',
    properties: ['openFile'],
    filters: [
      { name: 'Type Club Themes (*.json)', extensions: ['json'] },
      { name: 'Все файлы (*.*)', extensions: ['*'] },
    ],
  })

  if (canceled || !filePaths || filePaths.length === 0) return null

  try {
    const content = await fs.promises.readFile(filePaths[0], 'utf-8')
    const parsed = JSON.parse(content)
    const items = Array.isArray(parsed) ? parsed : [parsed]
    const validThemes: any[] = []

    for (const raw of items) {
      if (raw && typeof raw === 'object' && typeof raw.name === 'string' && raw.name.trim()) {
        const id = typeof raw.id === 'string' && raw.id ? raw.id : `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        validThemes.push({
          ...raw,
          id,
          isBuiltin: false,
        })
      }
    }

    if (validThemes.length === 0) return null

    const existing = (store.get('customThemes', []) as any[]) || []
    for (const newTheme of validThemes) {
      const idx = existing.findIndex((t: any) => t.id === newTheme.id || t.name === newTheme.name)
      if (idx >= 0) {
        existing[idx] = newTheme
      } else {
        existing.push(newTheme)
      }
    }
    store.set('customThemes', existing)

    return validThemes
  } catch (err) {
    console.error('Failed to import themes:', err)
    return null
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
