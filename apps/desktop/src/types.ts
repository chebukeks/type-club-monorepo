/**
 * type-club — Общие TypeScript-типы
 * Интерфейсы для файловой системы, вкладок и IPC API
 */
import type { ArticleListItem } from './api'

/** Элемент файлового дерева (файл или папка) */
export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
}

/** Элемент оглавления (TOC) документа */
export interface TocItem {
  id: string;
  text: string;
  level: number;
  pos: number;
}

/** Режим цветовой темы */
export type ThemeMode = 'light' | 'dark' | 'system';

/** Режим редактирования */
export type EditorMode = 'raw' | 'seamless' | 'preview';

/** Режим акцентирования (Фокус) */
export type FocusMode = 'none' | 'paragraph' | 'sentence' | 'lines';

/** Вкладка открытого файла в редакторе */
export interface Tab {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
  isModified: boolean;
  /** Счётчик для принудительного обновления */
  refreshCounter: number;
  /** Позиция прокрутки (для восстановления при переключении вкладок) */
  scrollTop: number;
  /** Если заполнен — вкладка является онлайн-статьёй с type-club.ru */
  articleId?: number;
  /** Активен ли режим советчика для этой вкладки */
  suggestionMode?: boolean;
}

/** Тип ограничения (символы или слова) */
export type LimitType = 'chars' | 'words';

/** Настройка ограничения для вкладки */
export interface WordLimit {
  /** Включено ли ограничение */
  enabled: boolean;
  /** Значение лимита */
  value: number;
  /** По чему ограничение: символы или слова */
  type: LimitType;
}

/** Состояние приложения (для useReducer) */
export interface AppState {
  /** Список открытых вкладок */
  tabs: Tab[];
  /** ID активной вкладки */
  activeTabId: string | null;
  /** Путь к открытой рабочей папке */
  folderPath: string | null;
  /** Дерево файлов текущей папки */
  fileTree: FileEntry[];
  /** Режим создания файла/папки (inline-ввод в Sidebar) */
  creating: { type: 'file' | 'folder', targetPath: string } | null;
  /** Режим отображения сайдбара: локальные файлы или онлайн-статьи */
  sidebarMode: 'local' | 'online';
  /** Кешированный список онлайн-статей (из type-club.ru) */
  onlineArticles: ArticleListItem[];
  /** Активная папка для создания файлов/папок (выбранная в сайдбаре) */
  activeExplorerPath: string | null;
  /** Режим переименования файла/папки в Sidebar */
  renaming: { path: string, type: 'file' | 'folder' } | null;
  /** Текущая цветовая тема */
  theme: ThemeMode;
  /** Автосохранение включено */
  autosave: boolean;
  /** Ограничение по символам/словам для активной вкладки */
  wordLimit: WordLimit;
  /** Показывать ли плашку статистики */
  showStats: boolean;
  /** Оглавление активного файла */
  activeToc: TocItem[];
  /** Режим печатной машинки */
  typewriterMode: boolean;
  /** Режим акцентирования */
  focusMode: FocusMode;
  /** Показывать пустые папки */
  showEmptyFolders: boolean;
  /** Глобальный режим редактирования */
  editorMode: EditorMode;
  /** Масштаб текста в процентах (50–200) — Ctrl+Shift++/- */
  textZoom: number;
  /** Масштаб документа в процентах (50–300) — Ctrl+Scroll, Ctrl+Alt++/- */
  documentZoom: number;
  /** Отображение сайдбара открыт/свёрнут */
  sidebarOpen: boolean;
}

/** Действия для редьюсера состояния */
export type AppAction =
  | { type: 'OPEN_FILE'; payload: { filePath: string; fileName: string; content: string; articleId?: number } }
  | { type: 'CLOSE_TAB'; payload: { tabId: string } }
  | { type: 'SET_ACTIVE_TAB'; payload: { tabId: string } }
  | { type: 'UPDATE_CONTENT'; payload: { tabId: string; content: string } }
  | { type: 'SET_FILE_TREE'; payload: { folderPath: string; fileTree: FileEntry[] } }
  | { type: 'MARK_SAVED'; payload: { tabId: string } }
  | { type: 'START_CREATING'; payload: { itemType: 'file' | 'folder', targetPath: string } }
  | { type: 'STOP_CREATING' }
  | { type: 'START_RENAMING'; payload: { path: string; itemType: 'file' | 'folder' } }
  | { type: 'STOP_RENAMING' }
  | { type: 'RENAME_TAB_PATHS'; payload: { oldPath: string; newPath: string } }
  | { type: 'SET_ACTIVE_EXPLORER_PATH'; payload: { path: string | null } }
  | { type: 'SET_THEME'; payload: { theme: ThemeMode } }
  | { type: 'SET_EDITOR_MODE'; payload: { mode: EditorMode } }
  | { type: 'REFRESH_TAB'; payload: { tabId: string } }
  | { type: 'SET_AUTOSAVE'; payload: { enabled: boolean } }
  | { type: 'SET_SHOW_STATS'; payload: { enabled: boolean } }
  | { type: 'SET_WORD_LIMIT'; payload: WordLimit }
  | { type: 'SET_ACTIVE_TOC'; payload: TocItem[] }
  | { type: 'SET_TYPEWRITER_MODE'; payload: { enabled: boolean } }
  | { type: 'SET_FOCUS_MODE'; payload: { mode: FocusMode } }
  | { type: 'SET_SHOW_EMPTY_FOLDERS'; payload: { enabled: boolean } }
  | { type: 'CLOSE_OTHER_TABS'; payload: { tabId: string } }
  | { type: 'SAVE_SCROLL_POSITION'; payload: { tabId: string; scrollTop: number } }
  | { type: 'SET_TEXT_ZOOM'; payload: { zoom: number } }
  | { type: 'SET_DOCUMENT_ZOOM'; payload: { zoom: number } }
  | { type: 'REORDER_TABS'; payload: { fromIndex: number; toIndex: number } }
  | { type: 'SET_SIDEBAR_MODE'; payload: { mode: 'local' | 'online' } }
  | { type: 'SET_ONLINE_ARTICLES'; payload: { articles: ArticleListItem[] } }
  | { type: 'SET_SUGGESTION_MODE'; payload: { tabId: string; active: boolean } }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR_OPEN'; payload: { open: boolean } };


/** API, доступный из Renderer-процесса через contextBridge */
export interface IElectronAPI {
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  readDir: (dirPath: string) => Promise<FileEntry[]>;
  exists: (filePath: string) => Promise<boolean>;
  createDir: (dirPath: string) => Promise<void>;
  renameItem: (oldPath: string, newPath: string) => Promise<void>;
  deleteItem: (filePath: string) => Promise<void>;
  showItemInFolder: (filePath: string) => void;
  confirmDelete: (itemName: string) => Promise<boolean>;
  openFolder: () => Promise<string | null>;
  openFile: () => Promise<{ filePath: string; content: string } | null>;
  saveFileAs: (content: string, defaultName: string) => Promise<{ filePath: string } | null>;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  openExternal: (url: string) => void;
  exportHtml: (content: string, defaultName: string) => Promise<boolean>;
  exportPdf: (content: string, defaultName: string) => Promise<boolean>;
  /** Чтение настроек из electron-store */
  storeGet: (key: string) => Promise<unknown>;
  /** Запись настроек в electron-store */
  storeSet: (key: string, value: unknown) => Promise<void>;
  /** Включить/выключить спеллчекер */
  setSpellcheck: (enabled: boolean) => Promise<void>;
  /** Получить текущее состояние спеллчекера */
  getSpellcheck: () => Promise<boolean>;
  /** Получить файлы, переданные при старте (Open with...) */
  getFilesToOpen: () => Promise<string[]>;
  /** Подписаться на открытие новых файлов (когда приложение уже запущен) */
  onOpenFiles: (callback: (paths: string[]) => void) => () => void;
  /** Диалог подтверждения выхода с несохранёнными файлами */
  confirmExit: (fileNames: string[]) => Promise<'save' | 'discard' | 'cancel'>;
  /** Подписка на событие закрытия окна */
  onBeforeClose: (callback: () => void) => () => void;
  /** Подтвердить закрытие окна (разрешить) */
  confirmClose: () => void;
  /** Увеличить масштаб интерфейса */
  zoomIn: () => void;
  /** Уменьшить масштаб интерфейса */
  zoomOut: () => void;
  /** Сбросить масштаб интерфейса */
  zoomReset: () => void;
}

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
