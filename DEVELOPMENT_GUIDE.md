# Type Club — Development Guide

## Обзор

Type Club — десктопный Markdown-редактор в стиле Typora с поддержкой LaTeX-формул, таблиц, task-lists и экспорта в HTML/PDF. Три режима редактирования: Seamless (Typora-стиль), Raw (исходный Markdown) и Preview (только просмотр).

### Стек технологий

| Технология | Назначение |
|---|---|
| Electron 30 | Десктопная оболочка, доступ к файловой системе |
| React 18 | UI-фреймворк |
| TypeScript 5 | Язык (strict mode) |
| ProseMirror | Ядро WYSIWYG-редактора (режимы Seamless/Raw) |
| Vite 5 | Сборщик + HMR |
| Tailwind CSS v4 | Стилизация UI-компонентов |
| KaTeX | Рендеринг LaTeX-формул |
| markdown-it | Парсинг Markdown → ProseMirror |
| highlight.js | Подсветка синтаксиса в код-блоках |
| electron-store | Персистентное хранилище настроек (тема и т.п.) |
| lucide-react | Иконки UI |

---

## Быстрый старт

```bash
# 1. Клонировать репозиторий
git clone <repo-url>
cd type-club

# 2. Установить зависимости
npm install

# 3. Запустить dev-сервер
npm run dev
```

Приложение откроется в окне Electron с HMR для React-компонентов.

---

## Архитектура

### Процессы Electron

```
┌─────────────────────────────────────────────────┐
│                  Main Process                    │
│  electron/main.ts                               │
│  - Создание BrowserWindow (frameless)           │
│  - IPC-хэндлеры (fs, dialog, export, store)    │
│  - Управление жизненным циклом приложения       │
└─────────────┬───────────────────────────────────┘
              │ contextBridge (preload.ts)
              │ window.api.*
┌─────────────▼───────────────────────────────────┐
│               Renderer Process                   │
│  src/                                            │
│  - React UI (TitleBar, MenuBar, Sidebar,        │
│    TabBar, MarkdownEditor)                       │
│  - ProseMirror (схема, плагины, nodeViews)      │
│  - Состояние: EditorContext (useReducer)        │
│  - Темы: light / dark / system                  │
└─────────────────────────────────────────────────┘
```

### Принцип безопасности

- `nodeIntegration: false` — Renderer не имеет доступа к Node.js
- `contextIsolation: true` — контексты изолированы
- Весь доступ к системе — через `window.api` (определён в `preload.ts`)

---

## Структура проекта

```
type-club/
├── electron/                    # Electron (Main Process)
│   ├── main.ts                  #   Главный процесс: окно, IPC, экспорт, store
│   ├── preload.ts               #   Bridge: contextBridge → window.api
│   └── electron-env.d.ts        #   Типы process.env
│
├── src/                         # React + ProseMirror (Renderer)
│   ├── main.tsx                 #   Точка входа React
│   ├── App.tsx                  #   Корневой layout: TitleBar + MenuBar + Sidebar + TabBar + Editor
│   ├── index.css                #   Глобальные стили + Tailwind v4 + CSS-переменные тем
│   ├── types.ts                 #   TypeScript-интерфейсы (FileEntry, Tab, ThemeMode, EditorMode, IPC API)
│   ├── vite-env.d.ts            #   Типы Vite
│   │
│   ├── assets/                  #   Статические ресурсы (импортируемые через Vite)
│   │
│   ├── context/
│   │   └── EditorContext.tsx    #   Глобальное состояние (useReducer + Context)
│   │
│   ├── components/
│   │   ├── TitleBar.tsx         #   Кастомный titlebar (frameless window)
│   │   ├── MenuBar.tsx          #   Меню: File, Edit (заглушка), View (тема, режим)
│   │   ├── Sidebar.tsx          #   Файловый проводник (дерево .md) + создание файлов/папок
│   │   ├── TabBar.tsx           #   Панель вкладок
│   │   └── MarkdownEditor.tsx   #   React-обёртка ProseMirror
│   │
│   └── editor/                  #   Ядро ProseMirror
│       ├── schema.ts            #     Схема документа (ноды + марки)
│       ├── markdownConfig.ts    #     Парсер + Сериализатор (MD ↔ PM) + generateExportHtml()
│       ├── keymap.ts            #     Горячие клавиши редактора
│       ├── inputRules.ts        #     Авто-форматирование при вводе
│       ├── editorTheme.ts       #     CSS-стили WYSIWYG-отображения
│       ├── seamlessPlugin.ts    #     Typora-стиль (бесшовные заголовки)
│       ├── codeBlockView.ts     #     NodeView: блоки кода + highlight.js
│       ├── mathBlockView.ts     #     NodeView: блочные формулы (KaTeX)
│       ├── mathInlineView.ts    #     NodeView: инлайн-формулы ($...$)
│       ├── mathActivePlugin.ts  #     Переключение редактирования/рендера формул
│       ├── linkTooltipPlugin.ts #     Тултип при наведении на ссылку
│       └── syntaxHighlightPlugin.ts # Подсветка синтаксиса
│
├── public/                      # Статические ассеты (SVG-иконки)
├── scripts/                     # Вспомогательные скрипты
├── test-examples/               # Тестовые .md файлы и бэклог
├── electron-builder.json5       # Конфигурация сборки (Win/Mac/Linux)
├── vite.config.ts               # Конфигурация Vite + Electron plugin
├── tsconfig.json                # TypeScript (src)
├── tsconfig.node.json           # TypeScript (electron + vite config)
├── .eslintrc.cjs                # ESLint конфигурация
├── RELEASE_GUIDE.md             # Гайд по релизу и сборке
└── package.json                 # Зависимости и npm-скрипты
```

---

## Управление состоянием

Состояние приложения хранится в `EditorContext.tsx` через `useReducer`:

### Типы

```typescript
/** Режим цветовой темы */
type ThemeMode = 'light' | 'dark' | 'system'

/** Режим редактирования */
type EditorMode = 'raw' | 'seamless' | 'preview'

/** Вкладка открытого файла */
interface Tab {
  id: string
  filePath: string
  fileName: string
  content: string
  isModified: boolean
  mode: EditorMode          // Режим редактирования вкладки
  refreshCounter: number    // Счётчик для принудительного обновления
}

/** Состояние приложения */
interface AppState {
  tabs: Tab[]                   // Открытые вкладки
  activeTabId: string | null    // Активная вкладка
  folderPath: string | null     // Путь к рабочей папке
  fileTree: FileEntry[]         // Дерево файлов
  creating: { type: 'file' | 'folder' } | null  // Режим создания (inline-ввод в Sidebar)
  theme: ThemeMode              // Текущая цветовая тема
}
```

### Действия (Actions)

| Action | Описание |
|---|---|
| `OPEN_FILE` | Открыть файл во вкладке (или активировать существующую) |
| `CLOSE_TAB` | Закрыть вкладку |
| `SET_ACTIVE_TAB` | Переключить активную вкладку |
| `UPDATE_CONTENT` | Обновить содержимое (при редактировании) |
| `SET_FILE_TREE` | Установить дерево файлов после открытия папки |
| `MARK_SAVED` | Пометить вкладку как сохранённую |
| `START_CREATING` | Начать создание файла/папки (показать inline-ввод в Sidebar) |
| `STOP_CREATING` | Отменить создание файла/папки |
| `SET_THEME` | Установить тему (light / dark / system) |
| `SET_TAB_MODE` | Установить режим редактирования вкладки (raw / seamless / preview) |
| `REFRESH_TAB` | Принудительно обновить содержимое вкладки |

### Методы EditorContext

| Метод | Описание |
|---|---|
| `openFile(filePath, fileName)` | Прочитать файл и открыть вкладку |
| `saveActiveFile()` | Сохранить активную вкладку |
| `saveActiveFileAs()` | Сохранить как... (диалог) |
| `openFolder()` | Открыть папку (диалог) |
| `openFileViaDialog()` | Открыть файл через диалог |
| `createFile(fileName)` | Создать .md файл в текущей папке |
| `createFolder(folderName)` | Создать подпапку в текущей папке |
| `refreshFileTree()` | Обновить дерево файлов |
| `setTheme(theme)` | Установить тему + сохранить в electron-store |
| `setTabMode(tabId, mode)` | Установить режим редактирования |
| `refreshTab(tabId)` | Принудительно обновить вкладку |

---

## ProseMirror: как работает редактор

### Жизненный цикл документа

```
Открытие файла:
  fs.readFile → markdown string → parseMarkdown() → ProseMirror Doc

Редактирование:
  ProseMirror Doc → serializeMarkdown() → UPDATE_CONTENT → state.content

Сохранение (Ctrl+S):
  state.content → fs.writeFile → MARK_SAVED
```

### Schema (модель документа)

Определена в `src/editor/schema.ts`. Поддерживаемые элементы:

**Ноды (блоки):**
- `doc`, `paragraph`, `heading` (h1-h6), `blockquote`
- `code_block` (с параметром языка)
- `bullet_list`, `ordered_list`, `list_item` (с поддержкой task-lists)
- `table`, `table_row`, `table_cell`, `table_header`
- `math_inline`, `math_block` (KaTeX)
- `image`, `horizontal_rule`, `hard_break`

**Марки (инлайн-стили):**
- `strong` (**жирный**), `em` (*курсив*), `code` (`код`)
- `s` (~~зачёркнутый~~), `highlight` (==выделение==)
- `link` ([текст](url))

### Добавление нового элемента

1. Добавить нод/марку в `schema.ts`
2. Добавить парсинг в `markdownConfig.ts` (маппинг markdown-it токена → PM нод)
3. Добавить сериализацию в `markdownConfig.ts` (PM нод → markdown текст)
4. (Опционально) Создать NodeView для кастомного рендеринга
5. Проверить round-trip: `parse(serialize(parse(markdown))) === parse(markdown)`

---

## IPC API (window.api)

### Файловая система

| Метод | Описание |
|---|---|
| `readFile(path)` | Чтение файла (UTF-8) |
| `writeFile(path, content)` | Запись файла |
| `readDir(path)` | Рекурсивное чтение директории (только .md) |
| `createDir(path)` | Создание директории |

### Диалоги

| Метод | Описание |
|---|---|
| `openFolder()` | Выбор рабочей папки |
| `openFile()` | Выбор .md файла → `{ filePath, content }` |
| `saveFileAs(content, defaultName)` | Сохранить как... → `{ filePath }` |

### Экспорт

| Метод | Описание |
|---|---|
| `exportHtml(content, name)` | Экспорт в HTML |
| `exportPdf(content, name)` | Экспорт в PDF (через скрытое окно Chromium) |

### Хранилище настроек (electron-store)

| Метод | Описание |
|---|---|
| `storeGet(key)` | Получить значение из хранилища |
| `storeSet(key, value)` | Сохранить значение в хранилище |

### Управление окном

| Метод | Описание |
|---|---|
| `minimizeWindow()` | Свернуть |
| `maximizeWindow()` | Развернуть/восстановить |
| `closeWindow()` | Закрыть |

### Добавление нового IPC-канала

Требует изменений в **3 файлах**:

1. **`electron/main.ts`** — добавить `ipcMain.handle('namespace:method', ...)`
2. **`electron/preload.ts`** — добавить метод в `contextBridge.exposeInMainWorld()`
3. **`src/types.ts`** — добавить метод в интерфейс `IElectronAPI`

---

## Горячие клавиши

> **Примечание:** Глобальные шорткаты используют `e.code` (физическая клавиша) для корректной работы в любой раскладке.

### Глобальные (MenuBar)

| Комбинация | Действие |
|---|---|
| `Ctrl+S` | Сохранить |
| `Ctrl+Shift+S` | Сохранить как... |
| `Ctrl+O` | Открыть файл |
| `Ctrl+Shift+O` | Открыть папку |
| `Ctrl+N` | Создать файл (если открыта папка) |
| `Ctrl+Shift+N` | Создать папку (если открыта папка) |
| `F5` | Обновить вкладку |

### Редактор (ProseMirror keymap)

| Комбинация | Действие |
|---|---|
| `Ctrl+B` | Жирный текст |
| `Ctrl+I` | Курсив |
| `Ctrl+E` | Инлайн-код |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Ctrl+Shift+S` | Зачёркивание |
| `Ctrl+Shift+H` | Выделение (highlight) |
| `Ctrl+Shift+.` | Блок-цитата |
| `Tab` / `Shift+Tab` | Вложенность списков / навигация в таблицах |
| `Escape` | Выход из блока кода / таблицы / формулы |

---

## Меню приложения (MenuBar)

### File
- Создать файл / Создать папку
- Открыть файл / Открыть папку
- Сохранить / Сохранить как...
- Export to HTML / Export to PDF

### Edit
- *(заглушка — пока пусто)*

### View
- Обновить (F5)
- Тема → Светлая / Тёмная / Системная
- Режим → Raw / Seamless / Preview

---

## Стилизация

### Темы

Приложение поддерживает три режима темы: `light`, `dark`, `system`. Тема хранится в `electron-store` и применяется через атрибут `data-theme` на `<html>`. CSS-переменные определены в `src/index.css`.

### Дизайн-токены (тёмная тема)

```
Фон основной:     #1a1b1e
Фон панелей:       #1e1f22
Текст основной:    #e1e1e3
Текст вторичный:   #a0a4ab
Текст приглушённый:#6a6e78
Текст тёмный:      #3a3d44
Акцент:            #6c8cff
Бордеры:           #2d2e32
Hover:             #2a2d33
Danger:            #e81123
```

### Шрифты

- **UI**: `Inter` (300-700) — подключён через Google Fonts
- **Код**: `JetBrains Mono` (400, 500) — подключён через Google Fonts

### Подход к стилям

- Tailwind CSS v4 классы для компонентов (`src/components/`)
- CSS-in-JS (строки-шаблоны) для ProseMirror тема (`src/editor/editorTheme.ts`)
- Глобальные стили и CSS-переменные тем в `src/index.css`

### Единый дизайн dropdown/popup

Все всплывающие панели (MenuBar, SettingsPopup, StatsToast и любые будущие) **обязаны** следовать единому дизайн-паттерну:

```
Контейнер:    bg-[var(--bg-elevated)]  border border-[var(--border-strong)]  rounded-md  shadow-lg  py-1  z-50
Пункт:        CSS-класс .menu-item  (padding: 8px 20px, flex, justify-content: space-between)
Hover:        .menu-item.enabled:hover → background: var(--menu-hover-bg)
Разделители:  border-t border-[var(--border-strong)] my-1
Текст:        text-[13px], вторичный текст/шорткаты — text-[11px] text-[var(--text-dim)]
```

**НЕ** использовать: `rounded-lg`, произвольные padding, кастомные hover-цвета для popup-элементов.

---

## Сборка и выпуск

### Команды

```bash
npm run dev      # Dev server с HMR
npm run build    # tsc → vite build → electron-builder
npm run lint     # ESLint проверка
npm run preview  # Preview собранного фронтенда (без Electron)
```

### Конфигурация electron-builder

Файл: `electron-builder.json5`

- **Windows**: NSIS-установщик (x64)
- **macOS**: DMG
- **Linux**: AppImage
- Артефакты → `release/{version}/`

Подробнее: см. `RELEASE_GUIDE.md`

---

## Рекомендации по разработке

1. **Всегда тестируйте round-trip** при изменении парсера/сериализатора:
   открыть .md → отредактировать → сохранить → открыть снова → содержимое не потерялось

2. **Порядок плагинов в ProseMirror важен** — кастомные keymap-плагины должны идти
   перед `baseKeymap`, чтобы перехватывать клавиши первыми

3. **Не добавляйте `@ts-ignore` без крайней необходимости** — существующие подавления
   связаны с отсутствием типов у markdown-it плагинов

4. **Frameless window** — заголовок и кнопки управления окном реализованы вручную в
   `TitleBar.tsx`. Drag-зона настроена через `-webkit-app-region: drag`

5. **PDF-экспорт** использует скрытое окно Chromium + `printToPDF()`. Временный HTML
   сохраняется на диск (не data URI!) из-за CORS-ограничений для шрифтов KaTeX

6. **Горячие клавиши** используют `e.code` (физический код клавиши) вместо `e.key`,
   чтобы работать корректно в любой раскладке клавиатуры

7. **Настройки** хранятся через `electron-store` (IPC: `store:get`, `store:set`).
   Тема загружается при старте приложения из хранилища
