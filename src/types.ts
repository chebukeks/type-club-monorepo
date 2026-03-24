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

/** Вкладка открытого файла в редакторе */
export interface Tab {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
  isModified: boolean;
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
}

/** Действия для редьюсера состояния */
export type AppAction =
  | { type: 'OPEN_FILE'; payload: { filePath: string; fileName: string; content: string } }
  | { type: 'CLOSE_TAB'; payload: { tabId: string } }
  | { type: 'SET_ACTIVE_TAB'; payload: { tabId: string } }
  | { type: 'UPDATE_CONTENT'; payload: { tabId: string; content: string } }
  | { type: 'SET_FILE_TREE'; payload: { folderPath: string; fileTree: FileEntry[] } }
  | { type: 'MARK_SAVED'; payload: { tabId: string } };

/** API, доступный из Renderer-процесса через contextBridge */
export interface IElectronAPI {
  /** Чтение содержимого файла */
  readFile: (filePath: string) => Promise<string>;
  /** Запись содержимого в файл */
  writeFile: (filePath: string, content: string) => Promise<void>;
  /** Получение списка файлов и папок в директории */
  readDir: (dirPath: string) => Promise<FileEntry[]>;
  /** Открытие диалога выбора папки */
  openFolder: () => Promise<string | null>;
  /** Открытие диалога выбора файла */
  openFile: () => Promise<{ filePath: string; content: string } | null>;
  /** Управление окном */
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
}

/** Расширение глобального Window для доступа к API */
declare global {
  interface Window {
    api: IElectronAPI;
  }
}
