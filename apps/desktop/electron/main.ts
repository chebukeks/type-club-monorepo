import { app, BrowserWindow, ipcMain, dialog, shell, screen, clipboard } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import os from 'node:os'
import Store from 'electron-store'

// Используем встроенный оффлайн Hunspell вместо Windows Native Spellchecker.
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-features', 'WinUseBrowserSpellChecker')
}
// Оптимизация потребления ресурсов в фоне
app.commandLine.appendSwitch('disable-background-timer-throttling', 'false')

const __dirname = path.dirname(fileURLToPath(import.meta.url))

import { createRequire } from 'node:module'
import { MODERN_WORDS, RUSSIAN_PRODUCTIVE_PREFIXES, RUSSIAN_NOUN_SUFFIXES } from './modernWords'

const esmRequire = createRequire(import.meta.url)

// Локальный спеллчекер (0ms latency, оффлайн) с отложенной фоновой инициализацией
let spellRu: any = null
let spellEn: any = null
let englishWordsSet: Set<string> | null = null
const customWordsSet = new Set<string>()

let spellcheckInitialized = false
let spellcheckInitPromise: Promise<void> | null = null

async function ensureSpellcheckerReady(): Promise<void> {
  if (spellcheckInitialized) return
  if (spellcheckInitPromise) return spellcheckInitPromise

  spellcheckInitPromise = (async () => {
    try {
      const nspellModule = esmRequire('nspell')
      const dictRuModule = esmRequire('dictionary-ru')
      const dictEnModule = esmRequire('dictionary-en')
      const nspellFn = nspellModule.default || nspellModule

      spellRu = nspellFn(dictRuModule.default || dictRuModule)
      spellEn = nspellFn(dictEnModule.default || dictEnModule)
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

      try {
        const englishArray = esmRequire('an-array-of-english-words')
        if (Array.isArray(englishArray)) {
          englishWordsSet = new Set(englishArray)
        } else {
          englishWordsSet = new Set()
        }
      } catch (err) {
        console.error('[SPELLCHECK] Error loading extended english wordlist:', err)
        englishWordsSet = new Set()
      }

      spellcheckInitialized = true
    } catch (err) {
      console.error('[SPELLCHECK] Error initializing spellchecker in main:', err)
    } finally {
      spellcheckInitPromise = null
    }
  })()

  return spellcheckInitPromise
}

async function reinitCustomWords(): Promise<void> {
  await ensureSpellcheckerReady()
  customWordsSet.clear()
  const stored = (store.get('customDictionaryWords', []) as string[]) || []
  for (const w of stored) {
    const clean = w.trim().toLowerCase()
    if (clean) {
      customWordsSet.add(clean)
      if (spellRu) spellRu.add(clean)
      if (spellEn) spellEn.add(clean)
    }
  }
}

function isWordValidInternal(word: string, checkRu: boolean, checkEn: boolean): boolean {
  if (!word) return true
  if (word.length <= 1) return true
  if (!spellcheckInitialized) return true
  const lower = word.toLowerCase()

  if (customWordsSet.has(lower)) return true

  // 1. Проверка по полному расширенному словарю английского языка SCOWL (275 000 слов)
  if (checkEn && englishWordsSet && (englishWordsSet.has(lower) || englishWordsSet.has(word))) return true

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
  if (!spellcheckInitialized) return false
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

// ============================================================
// Безопасность: валидация путей для IPC файловых операций (Path Traversal Guard)
// ============================================================
const allowedRoots = new Set<string>()

function addAllowedRoot(targetPath?: string): void {
  if (!targetPath) return
  try {
    const resolved = path.resolve(targetPath).toLowerCase()
    try {
      const stat = fs.statSync(resolved)
      allowedRoots.add(stat.isDirectory() ? resolved : path.dirname(resolved))
    } catch {
      allowedRoots.add(path.dirname(resolved))
    }
  } catch { /* ignore */ }
}

function isPathAllowed(filePath: string): boolean {
  if (!filePath) return false
  try {
    const resolved = path.resolve(filePath).toLowerCase()
    // Разрешаем стандартные системные папки пользователя
    try {
      const docsDir = path.resolve(app.getPath('documents')).toLowerCase()
      if (resolved.startsWith(docsDir)) return true
    } catch { /* ignore */ }
    try {
      const desktopDir = path.resolve(app.getPath('desktop')).toLowerCase()
      if (resolved.startsWith(desktopDir)) return true
    } catch { /* ignore */ }
    try {
      const downloadsDir = path.resolve(app.getPath('downloads')).toLowerCase()
      if (resolved.startsWith(downloadsDir)) return true
    } catch { /* ignore */ }
    try {
      const userDataDir = path.resolve(app.getPath('userData')).toLowerCase()
      if (resolved.startsWith(userDataDir)) return true
    } catch { /* ignore */ }

    // Проверяем открытые пользователем папки/файлы
    for (const root of allowedRoots) {
      if (resolved.startsWith(root)) return true
    }
    return false
  } catch {
    return false
  }
}

function assertPathAllowed(filePath: string): void {
  if (!isPathAllowed(filePath)) {
    throw new Error(`[SECURITY] Access denied: path outside allowed directories (${filePath})`)
  }
}

// Загрузка сохранённых путей в доверенный список
try {
  const lastFolder = store.get('lastFolderPath') as string | undefined
  if (lastFolder) addAllowedRoot(lastFolder)
  const recentFolders = (store.get('recentFolders') as string[] | undefined) || []
  recentFolders.forEach(addAllowedRoot)
  const recentFiles = (store.get('recentFiles') as string[] | undefined) || []
  recentFiles.forEach(addAllowedRoot)
} catch { /* ignore */ }

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
initialFiles.forEach(addAllowedRoot)
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
    additionalFiles.forEach(addAllowedRoot)
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
    backgroundColor: '#18181b',       // Предотвращает белое мерцание при создании окна
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

    // Отложенная фоновая инициализация спеллчекера (не блокирует отображение окна)
    setTimeout(() => {
      ensureSpellcheckerReady().then(() => {
        const enabledSpellcheckLangs = (store.get('spellcheckLanguages', ['ru-RU', 'en-US']) as string[]) || ['ru-RU', 'en-US']
        applySpellCheckerLanguages(enabledSpellcheckLangs)

        const customWords = (store.get('customDictionaryWords', []) as string[]) || []
        for (const word of customWords) {
          try {
            win?.webContents.session.addWordToSpellCheckerDictionary(word)
          } catch { /* ignore */ }
        }
      }).catch((err) => console.error('[SPELLCHECK] Deferred init error:', err))
    }, 800)
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

  // Разрешаем создание вспомогательных окон (Picture-in-Picture для настроек темы)
  // и блокируем произвольные внешние всплывающие окна
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank' || !url || url.startsWith('about:')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          title: 'Type Club — Настройки',
          autoHideMenuBar: true,
          frame: true,
          show: true,
          width: 940,
          height: 700,
          minWidth: 600,
          minHeight: 450,
        },
      }
    }
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        shell.openExternal(url)
      } else {
        console.warn(`[SECURITY] Blocked windowOpen for non-http(s) URL: ${url}`)
      }
    } catch {
      console.warn(`[SECURITY] Blocked windowOpen for invalid URL: ${url}`)
    }
    return { action: 'deny' }
  })

  // Обеспечиваем фокус и отображение вспомогательных окон
  win.webContents.on('did-create-window', (childWindow) => {
    childWindow.show()
    childWindow.focus()
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
 * Рекурсивное чтение директории (неблокирующее асинхронное).
 * Возвращает дерево файлов/папок, фильтруя только .md файлы и папки.
 */
async function readDirRecursive(dirPath: string): Promise<FileEntry[]> {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    const result: FileEntry[] = []

    for (const entry of entries) {
      // Пропускаем скрытые файлы и node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

      const fullPath = path.join(dirPath, entry.name)

      if (entry.isDirectory()) {
        const children = await readDirRecursive(fullPath)
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
  assertPathAllowed(filePath)
  return fs.readFileSync(filePath, 'utf-8')
})

// --- Запись файла ---
ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string): Promise<void> => {
  assertPathAllowed(filePath)
  fs.writeFileSync(filePath, content, 'utf-8')
})

// --- Сохранение локального изображения ---
ipcMain.handle('fs:saveLocalImage', async (_event, docPath: string, filename: string, base64Data: string): Promise<string | null> => {
  try {
    assertPathAllowed(docPath)
    const dir = path.dirname(docPath)
    const imgPath = path.join(dir, filename)
    assertPathAllowed(imgPath)
    const buffer = Buffer.from(base64Data, 'base64')
    fs.writeFileSync(imgPath, buffer)
    return `./${filename}`
  } catch (err) {
    console.error('Failed to save local image', err)
    return null
  }
})

// --- Чтение директории (рекурсивно) ---
ipcMain.handle('fs:readDir', async (_event, dirPath: string): Promise<FileEntry[]> => {
  assertPathAllowed(dirPath)
  return readDirRecursive(dirPath)
})

// --- Создание директории ---
ipcMain.handle('fs:createDir', async (_event, dirPath: string): Promise<void> => {
  assertPathAllowed(dirPath)
  fs.mkdirSync(dirPath, { recursive: true })
})

// --- Проверка существования ---
ipcMain.handle('fs:exists', async (_event, filePath: string): Promise<boolean> => {
  try {
    assertPathAllowed(filePath)
    return fs.existsSync(filePath)
  } catch {
    return false
  }
})

// --- Переименование ---
ipcMain.handle('fs:rename', async (_event, oldPath: string, newPath: string): Promise<void> => {
  assertPathAllowed(oldPath)
  assertPathAllowed(newPath)
  fs.renameSync(oldPath, newPath)
})

// --- Удаление (в корзину) ---
ipcMain.handle('fs:delete', async (_event, filePath: string): Promise<void> => {
  assertPathAllowed(filePath)
  await shell.trashItem(filePath)
})

// --- Показать в проводнике ---
ipcMain.on('shell:showItemInFolder', (_event, filePath: string) => {
  try {
    assertPathAllowed(filePath)
    shell.showItemInFolder(filePath)
  } catch { /* ignore */ }
})

// --- Копирование файла в системный буфер обмена как файла ---
ipcMain.handle('clipboard:copyFile', async (_event, filePath: string): Promise<boolean> => {
  try {
    assertPathAllowed(filePath)
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
  addAllowedRoot(result.filePaths[0])
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
  addAllowedRoot(filePath)
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
    addAllowedRoot(result.filePath)
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
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
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
ipcMain.handle('store:getAll', async () => {
  return store.store
})

ipcMain.handle('store:get', async (_event, key: string) => {
  return store.get(key)
})

ipcMain.handle('store:set', async (_event, key: string, value: unknown) => {
  if (key === 'lastFolderPath' && typeof value === 'string') {
    addAllowedRoot(value)
  } else if ((key === 'recentFolders' || key === 'recentFiles') && Array.isArray(value)) {
    value.forEach((item) => {
      if (typeof item === 'string') addAllowedRoot(item)
    })
  }
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
  await ensureSpellcheckerReady()
  return checkWordMisspelled(word)
})

/** Получить варианты исправлений для слова */
ipcMain.handle('spellcheck:getSuggestions', async (_event, word: string) => {
  await ensureSpellcheckerReady()
  return getWordSuggestions(word)
})

/** Пакетная проверка списка слов */
ipcMain.handle('spellcheck:checkWords', async (_event, words: string[]) => {
  if (!Array.isArray(words)) return []
  await ensureSpellcheckerReady()
  return words.filter((w) => checkWordMisspelled(w))
})

/** Добавить слово в пользовательский словарь */
ipcMain.handle('spellcheck:addCustomWord', async (_event, word: string) => {
  await ensureSpellcheckerReady()
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
  await reinitCustomWords()
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
ipcMain.on('window:openExternal', (_event, url: string) => {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      shell.openExternal(url)
    } else {
      console.warn(`[SECURITY] Blocked openExternal for non-http(s) URL: ${url}`)
    }
  } catch {
    console.warn(`[SECURITY] Blocked openExternal for invalid URL: ${url}`)
  }
})

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
// IPC-хэндлеры для автообновления приложения (OWASP ASVS V10.3 & A08:2021 Compliant)
// ============================================================
const verifiedUpdateFiles = new Set<string>()

function validateUpdateUrl(urlStr: string): URL {
  let parsed: URL
  try {
    parsed = new URL(urlStr)
  } catch {
    throw new Error('Invalid URL format for update')
  }

  const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1'
  if (parsed.protocol !== 'https:' && (!isLocal || (app.isPackaged && !isLocal))) {
    throw new Error('Insecure transport: application updates must be transmitted over HTTPS (OWASP ASVS V10.3.1)')
  }

  if (parsed.hostname === '169.254.169.254' || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) {
    throw new Error('Update destination rejected by security policy')
  }

  return parsed
}

function sanitizeUpdateFileName(fileName: string): string {
  const base = path.basename(fileName)
  if (!/^[a-zA-Z0-9._-]+$/.test(base)) {
    throw new Error('Security violation: update filename contains invalid or dangerous characters')
  }
  return base
}

function isNewerVersion(remoteVersion: string, localVersion: string): boolean {
  const clean = (v: string) => v.replace(/^v/i, '').trim()
  const rParts = clean(remoteVersion).split('.').map((p) => parseInt(p, 10) || 0)
  const lParts = clean(localVersion).split('.').map((p) => parseInt(p, 10) || 0)
  for (let i = 0; i < Math.max(rParts.length, lParts.length); i++) {
    const r = rParts[i] || 0
    const l = lParts[i] || 0
    if (r > l) return true
    if (r < l) return false
  }
  return false
}

function detectInstallType(): 'portable' | 'installer' | 'appimage' | 'dmg' {
  if (process.platform === 'win32') {
    if (!app.isPackaged) return 'portable'
    if (process.env.PORTABLE_EXECUTABLE_DIR) return 'portable'
    const exeDir = path.dirname(process.execPath)
    const hasUninstaller =
      fs.existsSync(path.join(exeDir, 'Uninstall TypeClub.exe')) ||
      fs.existsSync(path.join(exeDir, 'Uninstall Type Club.exe')) ||
      fs.existsSync(path.join(exeDir, 'Uninstall.exe'))
    return hasUninstaller ? 'installer' : 'portable'
  } else if (process.platform === 'linux') {
    return 'appimage'
  } else if (process.platform === 'darwin') {
    return 'dmg'
  }
  return 'portable'
}

ipcMain.handle('app:get-version', () => {
  return app.getVersion()
})

ipcMain.handle('app:check-update', async (_event, siteUrl: string) => {
  try {
    const cleanSite = (siteUrl || 'https://type-club.ru').replace(/\/$/, '')
    const manifestUrl = `${cleanSite}/downloads/latest.json`
    const parsedManifestUrl = validateUpdateUrl(manifestUrl)

    const manifestData = await new Promise<any>((resolve, reject) => {
      const protocol = parsedManifestUrl.protocol === 'https:' ? https : http
      const req = protocol.get(manifestUrl, (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Failed to fetch latest.json: HTTP ${res.statusCode}`))
        }
        let data = ''
        res.on('data', (chunk) => {
          if (data.length + chunk.length > 512 * 1024) {
            req.destroy()
            return reject(new Error('Manifest file size exceeded maximum allowable limit'))
          }
          data += chunk
        })
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(e)
          }
        })
      })
      req.on('error', reject)
      req.setTimeout(8000, () => {
        req.destroy()
        reject(new Error('Update check timeout'))
      })
    })

    const currentVersion = app.getVersion()
    const latestVersion = String(manifestData.version || '')
    // OWASP ASVS V10.3.3: Защита от Downgrade/Rollback-атак
    const updateAvailable = isNewerVersion(latestVersion, currentVersion)
    const installType = detectInstallType()

    let fileInfo = null
    if (installType === 'portable') {
      fileInfo = manifestData.platforms?.windows?.portable || manifestData.platforms?.windows?.installer
    } else if (installType === 'installer') {
      fileInfo = manifestData.platforms?.windows?.installer || manifestData.platforms?.windows?.portable
    } else if (installType === 'appimage') {
      fileInfo = manifestData.platforms?.linux?.appimage
    } else if (installType === 'dmg') {
      fileInfo = manifestData.platforms?.macos?.dmg
    }

    if (fileInfo && fileInfo.file) {
      fileInfo.file = sanitizeUpdateFileName(fileInfo.file)
    }

    const downloadUrl = fileInfo ? `${cleanSite}/downloads/${fileInfo.file}` : null

    return {
      updateAvailable,
      currentVersion,
      latestVersion,
      releaseDate: manifestData.releaseDate,
      installType,
      fileInfo,
      downloadUrl,
    }
  } catch (err: any) {
    console.warn('[UPDATER] Check failed:', err.message)
    return {
      updateAvailable: false,
      currentVersion: app.getVersion(),
      latestVersion: app.getVersion(),
      error: err.message,
    }
  }
})

ipcMain.handle('app:download-update', async (_event, downloadUrl: string, rawFileName: string, expectedSha256?: string) => {
  const fileName = sanitizeUpdateFileName(rawFileName)
  const tempDir = path.resolve(path.join(app.getPath('temp'), 'typeclub-update'))
  await fs.promises.mkdir(tempDir, { recursive: true })
  const targetFile = path.resolve(path.join(tempDir, fileName))

  // OWASP ASVS V10.3.4 & A01: Path Confinement
  if (!targetFile.startsWith(tempDir)) {
    throw new Error('Access denied: target file path escapes update temporary directory')
  }

  validateUpdateUrl(downloadUrl)
  const MAX_UPDATE_SIZE = 500 * 1024 * 1024 // 500 МБ лимит защиты от DoS

  const downloadFileWithRedirects = (currentUrl: string, redirectCount = 0): Promise<{ success: boolean; filePath: string; sha256: string }> => {
    if (redirectCount > 5) {
      return Promise.reject(new Error('Too many redirects'))
    }

    const parsedUrl = validateUpdateUrl(currentUrl)

    return new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(targetFile)
      const hashStream = crypto.createHash('sha256')
      const protocol = parsedUrl.protocol === 'https:' ? https : http

      const cleanupAndReject = async (err: Error) => {
        fileStream.close()
        try { await fs.promises.unlink(targetFile) } catch {}
        reject(err)
      }

      const req = protocol.get(currentUrl, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fileStream.close()
          let nextUrl = res.headers.location
          if (!nextUrl.startsWith('http')) {
            const u = new URL(currentUrl)
            nextUrl = `${u.origin}${nextUrl}`
          }
          return resolve(downloadFileWithRedirects(nextUrl, redirectCount + 1))
        }

        if (res.statusCode !== 200) {
          return cleanupAndReject(new Error(`Download failed with HTTP ${res.statusCode}`))
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10)
        let bytesDownloaded = 0

        res.on('data', (chunk) => {
          bytesDownloaded += chunk.length
          if (bytesDownloaded > MAX_UPDATE_SIZE) {
            req.destroy()
            return cleanupAndReject(new Error('Update package exceeded maximum allowable size'))
          }
          fileStream.write(chunk)
          hashStream.update(chunk)
          const percent = totalBytes > 0 ? Math.round((bytesDownloaded / totalBytes) * 100) : 0
          win?.webContents.send('app:update-progress', {
            bytesDownloaded,
            totalBytes,
            percent,
          })
        })

        res.on('end', () => {
          fileStream.end(async () => {
            const actualSha256 = hashStream.digest('hex').toLowerCase()

            // OWASP A08:2021 & ASVS V10.3.2: Проверка криптографической целостности
            if (expectedSha256 && expectedSha256.trim()) {
              const expected = expectedSha256.trim().toLowerCase()
              if (actualSha256 !== expected) {
                try { await fs.promises.unlink(targetFile) } catch {}
                return reject(new Error(`Cryptographic integrity failure: SHA-256 mismatch (expected: ${expected}, got: ${actualSha256})`))
              }
            }

            verifiedUpdateFiles.add(targetFile)
            resolve({ success: true, filePath: targetFile, sha256: actualSha256 })
          })
        })

        res.on('error', (err) => {
          cleanupAndReject(err)
        })
      })

      req.on('error', (err) => {
        cleanupAndReject(err)
      })
    })
  }

  return downloadFileWithRedirects(downloadUrl)
})

ipcMain.handle('app:install-update', async (_event, filePath: string, installType: string) => {
  const resolvedPath = path.resolve(filePath)
  const tempDir = path.resolve(path.join(app.getPath('temp'), 'typeclub-update'))

  // OWASP ASVS V10.3.4: Проверка, что файл находится строго в доверенной временной директории обновления
  if (!resolvedPath.startsWith(tempDir)) {
    throw new Error('Access denied: update package must reside in update temporary directory')
  }

  // OWASP ASVS V10.3.2: Проверка, что файл был загружен и верифицирован в рамках текущей сессии апдейтера
  if (!verifiedUpdateFiles.has(resolvedPath)) {
    throw new Error('Security violation: update package was not verified by updater session')
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error('Update file does not exist')
  }

  if (installType === 'portable' && process.platform === 'win32') {
    const extractDir = path.resolve(path.join(tempDir, 'extracted'))
    await fs.promises.rm(extractDir, { recursive: true, force: true })
    await fs.promises.mkdir(extractDir, { recursive: true })

    // Безопасный вызов PowerShell через spawn с массивом аргументов (без cmd shell injection)
    await new Promise<void>((resolve, reject) => {
      const ps = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Expand-Archive',
        '-LiteralPath',
        resolvedPath,
        '-DestinationPath',
        extractDir,
        '-Force',
      ], {
        stdio: 'ignore',
        windowsHide: true,
      })
      ps.on('error', reject)
      ps.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`PowerShell Expand-Archive failed with code ${code}`))
      })
    })

    // OWASP Zip Slip Prevention: Проверка, что ни один файл не распаковался за пределы extractDir
    async function verifyZipSlip(dir: string): Promise<void> {
      const items = await fs.promises.readdir(dir, { withFileTypes: true })
      for (const item of items) {
        const full = path.resolve(dir, item.name)
        if (!full.startsWith(extractDir)) {
          throw new Error('Security violation: Zip Slip path traversal detected in archive')
        }
        if (item.isDirectory()) {
          await verifyZipSlip(full)
        }
      }
    }
    await verifyZipSlip(extractDir)

    let sourceDir = extractDir
    const entries = await fs.promises.readdir(extractDir)
    if (entries.length === 1) {
      const sub = path.join(extractDir, entries[0])
      const stat = await fs.promises.stat(sub)
      if (stat.isDirectory()) {
        sourceDir = sub
      }
    }

    const targetDir = app.isPackaged ? path.dirname(process.execPath) : path.join(tempDir, 'simulated-target')
    if (!app.isPackaged) {
      await fs.promises.mkdir(targetDir, { recursive: true })
    }
    const exeName = app.isPackaged ? path.basename(process.execPath) : 'TypeClub.exe'
    const pid = process.pid
    if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) {
      throw new Error('Invalid process PID')
    }

    const batPath = path.join(tempDir, 'apply-update.bat')
    const batContent = `@echo off
chcp 65001 > nul
timeout /t 1 /nobreak > nul
taskkill /F /PID ${pid} > nul 2>&1
timeout /t 1 /nobreak > nul
xcopy "${sourceDir}\\*" "${targetDir}\\" /E /Y /I /Q
start "" "${path.join(targetDir, exeName)}"
del "%~f0"
`
    await fs.promises.writeFile(batPath, batContent, 'utf-8')

    const child = spawn('cmd.exe', ['/c', batPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
    child.unref()

    allowClose = true
    app.quit()
    return { success: true }
  }

  if (installType === 'installer' && process.platform === 'win32') {
    const child = spawn(resolvedPath, ['--updated'], {
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
    allowClose = true
    app.quit()
    return { success: true }
  }

  if (installType === 'appimage' && process.platform === 'linux') {
    fs.chmodSync(resolvedPath, 0o755)
    const targetAppImage = process.env.APPIMAGE || resolvedPath
    const shPath = path.join(tempDir, 'apply-update.sh')
    const shContent = `#!/bin/sh
sleep 1
cp -f "${resolvedPath}" "${targetAppImage}"
chmod +x "${targetAppImage}"
exec "${targetAppImage}" &
rm -f "$0"
`
    await fs.promises.writeFile(shPath, shContent, { mode: 0o755 })
    const child = spawn('/bin/sh', [shPath], {
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
    allowClose = true
    app.quit()
    return { success: true }
  }

  if (installType === 'dmg' && process.platform === 'darwin') {
    await shell.openPath(resolvedPath)
    allowClose = true
    app.quit()
    return { success: true }
  }

  return { success: false, error: 'Unsupported platform' }
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
