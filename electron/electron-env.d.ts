/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    APP_ROOT: string
    VITE_PUBLIC: string
  }
}

/**
 * Типы для IPC API, доступного через contextBridge.
 * Renderer-процесс обращается к API через window.api.
 */
interface Window {
  api: import('../src/types').IElectronAPI
}
