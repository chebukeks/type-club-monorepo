# Type Club — Development Guide

## Обзор

Type Club — монорепа с общим Markdown-редактором (ProseMirror), десктопным приложением (Electron) и веб-версией.

```
type-club-monorepo/
├── packages/
│   └── editor/          @type-club/editor — общий редактор (плагины ProseMirror + EditorCore)
├── apps/
│   ├── desktop/         Electron-приложение (бывший type-club)
│   └── web/             SPA (бывший type-club-web/frontend)
├── backend/             FastAPI (бывший type-club-web/backend)
├── nginx/               Конфиги веб-сервера
├── DEPLOY.md            Инструкции по деплою
├── SECURITY.md          Замечания по безопасности
└── package.json         npm workspaces
```

### Стек технологий

| Технология | Назначение |
|---|---|
| Electron 30 | Десктопная оболочка, доступ к файловой системе |
| React 18 | UI-фреймворк |
| TypeScript 5 | Язык (strict mode) |
| ProseMirror | Ядро WYSIWYG-редактора |
| Vite 5 | Сборщик + HMR |
| Tailwind CSS v4 | Стилизация UI-компонентов |
| KaTeX | Рендеринг LaTeX-формул |
| markdown-it | Парсинг Markdown → ProseMirror |
| highlight.js | Подсветка синтаксиса в код-блоках |
| electron-store | Персистентное хранилище настроек (desktop) |
| FastAPI | Бэкенд (веб-версия) |
| PostgreSQL | База данных (веб-версия) |
| lucide-react | Иконки UI |

---

## Быстрый старт

```bash
# 1. Клонировать монорепу
git clone https://github.com/chebukeks/type-club-monorepo.git
cd type-club-monorepo

# 2. Установить все зависимости (npm workspaces)
npm install

# 3. Запустить dev-сервер:

# Десктоп (Electron + HMR):
npm run dev:desktop
# или вручную:
cd apps/desktop && npm run dev

# Веб-версия (SPA, :5173):
npm run dev:web
# или вручную:
cd apps/web && npm run dev
```

**Примечание:** в РФ npmjs.org может быть медленным. В проекте настроено зеркало `registry.npmmirror.com` через `.npmrc`. При необходимости заменить.

---

## Архитектура десктоп-приложения

### Процессы Electron

```
┌─────────────────────────────────────────────────┐
│                  Main Process                    │
│  electron/main.ts                               │
│  - Создание BrowserWindow (frameless)           │
│  - IPC-хэндлеры (fs, dialog, export, store,    │
│    spellcheck, file association)                 │
│  - Управление жизненным циклом приложения       │
│  - Single instance lock + Open with...          │
└─────────────┬───────────────────────────────────┘
              │ contextBridge (preload.ts)
              │ window.api.*
┌─────────────▼───────────────────────────────────┐
│               Renderer Process                   │
│  src/                                            │
│  - React UI (TitleBar, MenuBar, Sidebar,        │
│    TabBar, MarkdownEditor, SettingsPopup,        │
│    StatsToast)                                   │
│  - ProseMirror (подключается из @type-club/editor)│
│  - Состояние: EditorContext (useReducer)        │
│  - Темы: light / dark / system                  │
└─────────────────────────────────────────────────┘
```

### Принцип безопасности

- `nodeIntegration: false` — Renderer не имеет доступа к Node.js
- `contextIsolation: true` — контексты изолированы
- Весь доступ к системе — через `window.api` (определён в `preload.ts`)

---

## Структура десктоп-приложения

```
apps/desktop/
├── electron/                    # Electron (Main Process)
│   ├── main.ts                  #   Главный процесс: окно, IPC, экспорт, store, spellcheck
│   ├── preload.ts               #   Bridge: contextBridge → window.api
│   └── electron-env.d.ts        #   Типы process.env
│
├── src/                         # React + ProseMirror (Renderer)
│   ├── main.tsx                 #   Точка входа React
│   ├── App.tsx                  #   Корневой layout: TitleBar + Sidebar + TabBar + Editor + StatsToast
│   ├── api.ts                   #   HTTP-клиент для type-club.ru API
│   ├── config.ts                #   URL-конфигурация (type-club.ru)
│   ├── index.css                #   Глобальные стили + Tailwind v4 + CSS-переменные тем
│   ├── types.ts                 #   TypeScript-интерфейсы
│   │
│   ├── context/
│   │   ├── EditorContext.tsx    #   Глобальное состояние (useReducer + Context)
│   │   └── AuthContext.tsx      #   Авторизация type-club.ru
│   │
│   └── components/
│       ├── TitleBar.tsx         #   Кастомный titlebar + кнопки auth/publish/settings
│       ├── MenuBar.tsx          #   Меню: File, Edit, View
│       ├── Sidebar.tsx          #   Файловый проводник + онлайн-статьи
│       ├── TabBar.tsx           #   Панель вкладок
│       ├── MarkdownEditor.tsx   #   Обёртка над EditorCore (zoom, data URI, typewriter)
│       ├── SearchBar.tsx        #   Поиск по документу (Ctrl+F)
│       ├── SettingsPopup.tsx    #   Настройки
│       ├── StatsToast.tsx       #   Статистика
│       ├── AuthModal.tsx        #   Авторизация
│       └── PublishModal.tsx     #   Публикация на type-club.ru
│
├── electron-builder.json5       # Конфигурация сборки (Win/Linux)
├── vite.config.ts               # Vite + Electron plugin
├── tsconfig.json                # TypeScript (src)
├── tsconfig.node.json           # TypeScript (electron + vite config)
└── package.json                 # Зависимости и скрипты
```

> **Важно:** плагины ProseMirror вынесены в `packages/editor/`. Десктоп использует их через `import ... from '@type-club/editor'`. При изменении редактора — править нужно в `packages/editor/`, изменения автоматически подхватятся обоими приложениями.

---

## Пакет @type-club/editor

Общий редактор, используемый десктопом и веб-версией:

```
packages/editor/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts              # Публичный API пакета
    ├── types.ts              # EditorMode, EditorProps, FocusMode, TocItem, CollaborationConfig
    ├── EditorCore.tsx         # Базовый компонент редактора ( seamless / raw / preview )
    └── editor/               # Плагины ProseMirror
        ├── schema.ts              # Схема документа (ноды + марки)
        ├── markdownConfig.ts      # Парсер + Сериализатор (MD ↔ PM) + generateExportHtml()
        ├── keymap.ts              # Горячие клавиши редактора
        ├── inputRules.ts          # Авто-форматирование при вводе
        ├── editorTheme.ts         # CSS-стили WYSIWYG-отображения
        ├── seamlessPlugin.ts      # Typora-стиль
        ├── suggestionPlugin.ts    # Режим советчика (фильтрация транзакций, марки советов)
        ├── suggestionActionPlugin.ts # Плагин действий над советами (принять/отклонить)
        ├── suggestionNoteView.ts  # NodeView: примечания советчика
        ├── collaborationPlugin.ts # Yjs-синхронизация соавторства
        ├── codeBlockView.ts       # NodeView: блоки кода + highlight.js
        ├── mathBlockView.ts       # NodeView: блочные формулы (KaTeX)
        ├── mathInlineView.ts      # NodeView: инлайн-формулы
        ├── mathActivePlugin.ts    # Переключение редактирования/рендера формул
        ├── linkTooltipPlugin.ts   # Тултип при наведении на ссылку
        ├── syntaxHighlightPlugin.ts # Подсветка синтаксиса
        ├── focusModePlugin.ts     # Режим акцентирования
        ├── foldingPlugin.ts       # Сворачивание заголовков
        ├── headingView.ts         # NodeView: заголовки
        ├── imageView.ts           # NodeView: изображения + YouTube
        ├── interactivePlugin.ts   # Интерактивные элементы
        ├── pastePlugin.ts         # Умная вставка (блоки — после абзаца, текст — инлайн)
        ├── tableEditPlugin.ts     # Режим редактирования таблиц (overlay, DnD)
        ├── tocPlugin.ts           # Оглавление (Table of Contents)
        └── typographyPlugin.ts    # Авто-типографика (-- → —)
```

### EditorCore — API

```typescript
<EditorCore
  content={markdown}           // Содержимое в markdown
  editorMode="seamless"         // 'raw' | 'seamless' | 'preview'
  onChange={(md) => ...}        // Коллбэк при изменении
  textZoom={100}                // Масштаб текста (%)
  documentZoom={100}            // Масштаб документа (%)
  readOnly={false}              // Только чтение
  collaboration={collabConfig}  // Настройки Yjs/WebSocket синхронизации
  userRole="author"             // 'author' | 'co_author' | 'editor' | null
  userId={123}                  // ID пользователя
  userNickname="Alex"           // Никнейм для подписи советов
  suggestionModeActive={false}  // Флаг активности режима советчика
  className="typewriter-mode"   // CSS-класс на контейнер
  focusMode="paragraph"         // 'none' | 'paragraph' | 'sentence' | 'lines'
  onTocUpdate={(toc) => ...}    // Коллбэк оглавления (вызывается в seamless и preview)
  onEditorView={(view) => ...}  // Доступ к EditorView
  extraPlugins={[...]}          // Дополнительные ProseMirror-плагины
  containerStyle={{...}}        // Инлайн-стили контейнера
/>
```

---

## Управление состоянием (Desktop)

Состояние приложения хранится в `EditorContext.tsx` через `useReducer`:

### Типы

```typescript
type ThemeMode = 'light' | 'dark' | 'system'
type EditorMode = 'raw' | 'seamless' | 'preview'
type FocusMode = 'none' | 'paragraph' | 'sentence' | 'lines'
type LimitType = 'chars' | 'words'

interface WordLimit { enabled: boolean; value: number; type: LimitType }
interface TocItem { id: string; text: string; level: number; pos: number }

interface Tab {
  id: string; filePath: string; fileName: string; content: string
  isModified: boolean; mode: EditorMode; refreshCounter: number
}

interface AppState {
  tabs: Tab[]; activeTabId: string | null; folderPath: string | null
  fileTree: FileEntry[]; creating: { type: 'file' | 'folder' } | null
  theme: ThemeMode; autosave: boolean; wordLimit: WordLimit
  showStats: boolean; activeToc: TocItem[]
  typewriterMode: boolean; focusMode: FocusMode
}
```

### Действия

| Action | Описание |
|---|---|
| `OPEN_FILE` | Открыть файл во вкладке |
| `CLOSE_TAB` | Закрыть вкладку |
| `SET_ACTIVE_TAB` | Переключить активную вкладку |
| `UPDATE_CONTENT` | Обновить содержимое |
| `SET_FILE_TREE` | Установить дерево файлов |
| `MARK_SAVED` | Пометить вкладку как сохранённую |
| `SET_THEME` | Установить тему |
| `SET_TAB_MODE` | Установить режим редактирования |
| `REFRESH_TAB` | Принудительно обновить вкладку |
| `SET_ACTIVE_TOC` | Обновить оглавление |
| `SET_TYPEWRITER_MODE` | Режим печатной машинки |
| `SET_FOCUS_MODE` | Режим акцентирования |

### Автосохранение

- Debounce 5 секунд после последнего изменения
- Мгновенное сохранение при потере фокуса окна
- Состояние персистируется в `electron-store` (ключ `autosave`)

### Инициализация при запуске

Из `electron-store` восстанавливаются: тема, автосохранение, статистика, typewriter, focus mode, последняя папка, файлы из "Open with...".

---

## ProseMirror: как работает редактор

### Жизненный цикл документа

```
Открытие файла:
  fs.readFile → markdown → parseMarkdown() → ProseMirror Doc

Редактирование:
  ProseMirror Doc → serializeMarkdown() → UPDATE_CONTENT → state.content

Сохранение (Ctrl+S):
  state.content → fs.writeFile → MARK_SAVED
```

### Schema

Определена в `packages/editor/src/editor/schema.ts`.

**Ноды:** `doc`, `paragraph`, `heading`, `blockquote`, `code_block`, `bullet_list`, `ordered_list`, `list_item`, `table`, `table_row`, `table_cell`, `table_header`, `math_inline`, `math_block`, `image`, `horizontal_rule`, `hard_break`

**Марки:** `strong`, `em`, `code`, `s`, `highlight`, `spoiler`, `link`

### Порядок плагинов в ProseMirror

Важен: кастомные keymap-плагины должны идти перед `baseKeymap`, чтобы перехватывать клавиши первыми. Сборка плагинов — в `EditorCore.tsx`.

### Добавление нового элемента

1. Добавить нод/марку в `packages/editor/src/editor/schema.ts`
2. Добавить парсинг в `packages/editor/src/editor/markdownConfig.ts`
3. Добавить сериализацию в `packages/editor/src/editor/markdownConfig.ts`
4. (Опционально) Создать NodeView в `packages/editor/src/editor/`
5. Если нод должен вставляться из буфера как самостоятельный блок (после абзаца, как таблица/изображение) — добавить имя ноды в `BLOCK_PASTE_NODES` в `packages/editor/src/editor/pastePlugin.ts`
6. Проверить round-trip: `parse(serialize(parse(md))) === parse(md)`
7. Убедиться что оба приложения (desktop + web) работают после изменений

---

## IPC API (window.api) — Desktop

### Файловая система

| Метод | Описание |
|---|---|
| `readFile(path)` | Чтение файла (UTF-8) |
| `writeFile(path, content)` | Запись файла |
| `readDir(path)` | Рекурсивное чтение директории (.md) |
| `createDir(path)` | Создание директории |

### Диалоги

| Метод | Описание |
|---|---|
| `openFolder()` | Выбор рабочей папки |
| `openFile()` | Выбор .md файла |
| `saveFileAs(content, defaultName)` | Сохранить как... |

### Экспорт

| Метод | Описание |
|---|---|
| `exportHtml(content, name)` | Экспорт в HTML |
| `exportPdf(content, name)` | Экспорт в PDF |

### Хранилище (electron-store)

| Метод | Описание |
|---|---|
| `storeGet(key)` | Получить значение |
| `storeSet(key, value)` | Сохранить значение |

### Управление окном

| Метод | Описание |
|---|---|
| `minimizeWindow()`, `maximizeWindow()`, `closeWindow()` | Управление окном |
| `openExternal(url)` | Открыть ссылку в браузере |
| `zoomIn()`, `zoomOut()`, `zoomReset()` | Масштаб интерфейса |

### Добавление нового IPC-канала

Требует изменений в **3 файлах**:
1. `electron/main.ts` — `ipcMain.handle('namespace:method', ...)`
2. `electron/preload.ts` — добавить в `contextBridge.exposeInMainWorld()`
3. `src/types.ts` — добавить в интерфейс `IElectronAPI`

---

## Горячие клавиши

### Глобальные (MenuBar)

| Комбинация | Действие |
|---|---|
| `Ctrl+S` | Сохранить |
| `Ctrl+Shift+S` | Сохранить как... |
| `Ctrl+O` | Открыть файл |
| `Ctrl+Shift+O` | Открыть папку |
| `Ctrl+N` | Создать файл |
| `Ctrl+Shift+N` | Создать папку |
| `F5` | Обновить вкладку |

### Редактор (ProseMirror keymap)

| Комбинация | Действие |
|---|---|
| `Ctrl+B` | Жирный |
| `Ctrl+I` | Курсив |
| `Ctrl+E` | Инлайн-код |
| `Ctrl+Shift+X` | Зачёркивание |
| `Ctrl+Shift+H` | Выделение |
| `Ctrl+Shift+.` | Блок-цитата |
| `Tab` / `Shift+Tab` | Списки / таблицы |
| `Backspace` | Удаление math/таблиц/заголовков |

### Зум (Desktop)

| Комбинация | Действие |
|---|---|
| `Ctrl` + `=`/`-` | Интерфейс |
| `Ctrl+Shift` + `=`/`-` | Текст |
| `Ctrl+Alt` + `=`/`-` | Документ |
| `Ctrl+Scroll` | Документ |
| `Ctrl+Shift+Scroll` | Текст |
| `Ctrl` + `0` | Сброс интерфейса |
| `Ctrl+Shift` + `0` | Сброс текста |
| `Ctrl+Alt` + `0` | Сброс документа |

---

## Стилизация

### Темы (Desktop)

Три режима: `light`, `dark`, `system`. Хранятся в `electron-store`, применяются через `data-theme` на `<html>`. CSS-переменные в `src/index.css`.

### Подход к стилям

- Tailwind CSS v4 для компонентов
- CSS-in-JS (строки) для ProseMirror (`packages/editor/src/editor/editorTheme.ts`)
- Глобальные стили и CSS-переменные в `src/index.css` каждого приложения

### Единый дизайн dropdown/popup (Desktop)

```
Контейнер:  bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-md shadow-lg py-1 z-50
Пункт:      CSS-класс .menu-item  (padding: 8px 20px, flex, justify-content: space-between)
Hover:      .menu-item.enabled:hover → background: var(--menu-hover-bg)
Текст:      text-[13px], шорткаты: text-[11px] text-[var(--text-dim)]
```

**Важно:** для нестандартных элементов внутри меню (поля ввода, превью таблиц, кастомные контролы) **не использовать Tailwind-классы паддингов** (`px-5`, `py-2` и т.п.) — в некоторых контекстах (например, внутри `flex flex-col`-контейнера контекстного меню) они могут не применяться. Вместо этого задавать отступы инлайн-стилями, повторяющими `.menu-item`:
```tsx
style={{ padding: '8px 20px' }}  // идентично .menu-item
style={{ padding: '6px 12px' }}  // для кнопочной строки
```

### Единый дизайн модальных окон

Все модалки используют CSS-классы: `.modal-overlay`, `.modal-panel`, `.modal-title`, `.modal-input`, `.btn-primary`, `.btn-secondary` и т.д. Определены в `src/index.css`.

---

## Интеграция с type-club.ru

### API (Desktop + Web)

```
Renderer → fetch() → https://type-club.ru/api/*
Auth: JWT Bearer token, localStorage: access_token
```

### API endpoints

| Метод | Endpoint | Описание |
|---|---|---|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход |
| GET | `/api/auth/me` | Текущий пользователь |
| PATCH | `/api/auth/me` | Обновить профиль |
| POST | `/api/articles` | Создать статью |
| PATCH | `/api/articles/:id` | Обновить статью |

---

## Сборка и выпуск

### Команды (монорепа)

```bash
# Сборка веб-версии
npm run build:web          # tsc + vite build → apps/web/dist/

# Сборка десктопа
npm run build:desktop      # tsc + vite build + electron-builder
# или из директории:
cd apps/desktop && npm run build

# Собрать всё
npm run build
```

### Конфигурация electron-builder

Файл: `apps/desktop/electron-builder.json5`

- **Windows**: NSIS-установщик (x64) + ZIP
- **Linux**: AppImage
- Артефакты → `apps/desktop/release/{version}/`

### Деплой

Подробные инструкции: см. `DEPLOY.md`.

---

## Рекомендации по разработке

1. **Монорепа:** изменения в `packages/editor/` автоматически применяются к обоим приложениям. Перед коммитом проверять сборку обоих: `npm run build:web && cd apps/desktop && npx tsc --noEmit && npx vite build`

2. **Round-trip:** при изменении парсера/сериализатора всегда проверять: открыть .md → отредактировать → сохранить → открыть снова → содержимое не потерялось

3. **Порядок плагинов в ProseMirror:** кастомные keymap-плагины должны идти перед `baseKeymap`. Сборка — в `packages/editor/src/EditorCore.tsx`

4. **Desktop-специфичные плагины** (typewriterPlugin) передаются через проп `extraPlugins` в `EditorCore`

5. **Frameless window:** заголовок и кнопки управления окном в `TitleBar.tsx`. Drag-зона: `-webkit-app-region: drag`

6. **PDF-экспорт:** скрытое окно Chromium + `printToPDF()`. Временный HTML на диск из-за CORS для шрифтов KaTeX

7. **Горячие клавиши:** использовать `e.code` (физический код) вместо `e.key` для корректной работы в любой раскладке

8. **Настройки** (desktop) — через `electron-store` (IPC: `store:get`, `store:set`)

9. **Автосохранение** — debounce 5 сек + мгновенное при потере фокуса

10. **File Association** — single instance lock, `getFilesToOpen()` + `onOpenFiles(callback)`

11. **CSS-переменные тем** — каждый app определяет свои переменные в `index.css`. `editorTheme.ts` использует переменные нейтрально (работает в любом app)
