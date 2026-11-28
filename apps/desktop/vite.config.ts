import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5174,
    watch: {
      ignored: ['**/*.md', '**/*.txt', '**/tests/**', '**/release/**', '**/*.json'],
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: [
                'nspell',
                'dictionary-ru',
                'dictionary-en',
                'dictionary-en-gb',
                'an-array-of-english-words',
                'electron-store',
                'mammoth',
                'docx',
                'pdf-parse',
              ],
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
      },
      renderer: process.env.NODE_ENV === 'test'
        ? undefined
        : {},
    }),
    {
      name: 'desktop-dev-server-address',
      configureServer(server) {
        const httpServer = server.httpServer
        httpServer?.once('listening', () => {
          const address = httpServer.address()
          const devServerUrl = process.env.VITE_DEV_SERVER_URL
          if (!address || typeof address === 'string' || !devServerUrl) return
          if (address.address !== '127.0.0.1' && address.address !== '::1') return

          // vite-plugin-electron changes both loopback addresses to "localhost".
          // Use the bound address so Electron connects over the same IP family.
          const url = new URL(devServerUrl)
          if (url.hostname !== 'localhost') return
          url.hostname = address.family === 'IPv6' ? '[::1]' : address.address
          process.env.VITE_DEV_SERVER_URL = url.href
        })
      },
    },
  ],
})
