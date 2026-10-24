import WebSocket from 'ws'
import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import {
  seedYFragmentFromMarkdown,
  yFragmentToMarkdown,
} from '@type-club/editor/src/editor/collabSync.js'

const messageSync = 0

export class CollabClient {
  private wsUrl: string
  private token: string

  constructor(wsUrl: string, token: string) {
    this.wsUrl = wsUrl.replace(/\/+$/, '')
    this.token = token
  }

  async modifyCollaborativeArticle(
    articleId: number,
    modifier: (currentMarkdown: string) => string,
    timeoutMs: number = 10000
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const doc = new Y.Doc()
      const fragment = doc.getXmlFragment('content')
      let isSynced = false
      let modificationApplied = false
      let timer: NodeJS.Timeout | null = null

      const wsProtocol = this.wsUrl.startsWith('https') || this.wsUrl.startsWith('wss') ? 'wss' : 'ws'
      const cleanHost = this.wsUrl.replace(/^https?:\/\/|^wss?:\/\//, '')
      const url = `${wsProtocol}://${cleanHost}/?articleId=${articleId}&token=${encodeURIComponent(this.token)}`

      const ws = new WebSocket(url)

      const cleanup = () => {
        if (timer) clearTimeout(timer)
        try {
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close()
          }
        } catch {
          // ignore
        }
        doc.destroy()
      }

      timer = setTimeout(() => {
        cleanup()
        reject(new Error(`Collab-server connection timed out for article ${articleId} at ${url}`))
      }, timeoutMs)

      // CRUCIAL: Forward any local Y.Doc transactions (like modifications) to the collab-server
      doc.on('update', (update: Uint8Array, origin: any) => {
        if (origin !== ws && ws.readyState === WebSocket.OPEN) {
          const encoder = encoding.createEncoder()
          encoding.writeVarUint(encoder, messageSync)
          syncProtocol.writeUpdate(encoder, update)
          ws.send(encoding.toUint8Array(encoder))
        }
      })

      ws.on('open', () => {
        // Step 1: Send client state vector
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, messageSync)
        syncProtocol.writeSyncStep1(encoder, doc)
        ws.send(encoding.toUint8Array(encoder))
      })

      const performModification = () => {
        if (modificationApplied) return
        modificationApplied = true

        try {
          const currentMarkdown = yFragmentToMarkdown(fragment)
          const newMarkdown = modifier(currentMarkdown)

          if (newMarkdown !== currentMarkdown) {
            doc.transact(() => {
              fragment.delete(0, fragment.length)
              seedYFragmentFromMarkdown(newMarkdown, fragment)
            }, 'mcp-client')
          }

          // Wait 600ms to allow frames to flush over WebSocket and collab-server to persist/broadcast
          setTimeout(() => {
            cleanup()
            resolve(newMarkdown)
          }, 600)
        } catch (err) {
          cleanup()
          reject(err)
        }
      }

      ws.on('message', (data: WebSocket.RawData) => {
        try {
          const uint8 = new Uint8Array(data as ArrayBuffer)
          const decoder = decoding.createDecoder(uint8)
          const messageType = decoding.readVarUint(decoder)

          if (messageType === messageSync) {
            const encoder = encoding.createEncoder()
            encoding.writeVarUint(encoder, messageSync)
            const syncType = syncProtocol.readSyncMessage(decoder, encoder, doc, ws)

            // If readSyncMessage produced a response (e.g. SyncStep2), send it
            if (encoding.length(encoder) > 1) {
              ws.send(encoding.toUint8Array(encoder))
            }

            // SyncStep2 indicates server state has been applied to our local doc
            if (syncType === syncProtocol.messageYjsSyncStep2 || syncType === syncProtocol.messageYjsUpdate) {
              if (!isSynced) {
                isSynced = true
                setTimeout(performModification, 150)
              }
            }
          }
        } catch (err) {
          cleanup()
          reject(err)
        }
      })

      ws.on('error', (err) => {
        cleanup()
        reject(new Error(`WebSocket error connecting to collab-server at ${url}: ${err.message}`))
      })

      ws.on('close', (code, reason) => {
        if (!modificationApplied) {
          cleanup()
          reject(
            new Error(
              `Collab WebSocket closed before modification completed (code: ${code}, reason: ${reason.toString() || 'unknown'})`
            )
          )
        }
      })
    })
  }
}
