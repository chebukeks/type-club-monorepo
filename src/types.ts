/**
 * type-club — Общие TypeScript-типы
 * Интерфейсы для файловой системы, вкладок и IPC API
 */

/** Элемент файлового дерева (файл или папка) */
export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
}

/** Режим цветовой темы */
export type ThemeMode = 'light' | 'dark' | 'system';

/** Режим редактирования */
export type EditorMode = 'raw' | 'seamless' | 'preview';

/** Вкладка открытого файла в редакторе */
export interface Tab {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
  isModified: boolean;
  /** Режим редактирования вкладки */
  mode: EditorMode;
  /** Счётчик для принудительного обновления */
  refreshCounter: number;
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
  creating: { type: 'file' | 'folder' } | null;
  /** Текущая цветовая тема */
  theme: ThemeMode;
  /** Автосохранение включено */
  autosave: boolean;
  /** Ограничение по символам/словам для активной вкладки */
  wordLimit: WordLimit;
  /** Показывать ли плашку статистики */
  showStats: boolean;
}

/** Действия для редьюсера состояния */
export type AppAction =
  | { type: 'OPEN_FILE'; payload: { filePath: string; fileName: string; content: string } }
  | { type: 'CLOSE_TAB'; payload: { tabId: string } }
  | { type: 'SET_ACTIVE_TAB'; payload: { tabId: string } }
  | { type: 'UPDATE_CONTENT'; payload: { tabId: string; content: string } }
  | { type: 'SET_FILE_TREE'; payload: { folderPath: string; fileTree: FileEntry[] } }
  | { type: 'MARK_SAVED'; payload: { tabId: string } }
  | { type: 'START_CREATING'; payload: { itemType: 'file' | 'folder' } }
  | { type: 'STOP_CREATING' }
  | { type: 'SET_THEME'; payload: { theme: ThemeMode } }
  | { type: 'SET_TAB_MODE'; payload: { tabId: string; mode: EditorMode } }
  | { type: 'REFRESH_TAB'; payload: { tabId: string } }
  | { type: 'SET_AUTOSAVE'; payload: { enabled: boolean } }
  | { type: 'SET_SHOW_STATS'; payload: { enabled: boolean } }
  | { type: 'SET_WORD_LIMIT'; payload: WordLimit };

/** API, доступный из Renderer-процесса через contextBridge */
export interface IElectronAPI {
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  readDir: (dirPath: string) => Promise<FileEntry[]>;
  createDir: (dirPath: string) => Promise<void>;
  openFolder: () => Promise<string | null>;
  openFile: () => Promise<{ filePath: string; content: string } | null>;
  saveFileAs: (content: string, defaultName: string) => Promise<{ filePath: string } | null>;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
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
}

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
