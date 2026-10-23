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
    timeoutMs: number = 8000
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const doc = new Y.Doc()
      const fragment = doc.getXmlFragment('content')
      let isSynced = false
      let timer: NodeJS.Timeout | null = null

      const wsProtocol = this.wsUrl.startsWith('https') ? 'wss' : 'ws'
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
        reject(new Error(`Collab-server connection timed out for article ${articleId}`))
      }, timeoutMs)

      ws.on('open', () => {
        // Send SyncStep1
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, messageSync)
        syncProtocol.writeSyncStep1(encoder, doc)
        ws.send(encoding.toUint8Array(encoder))
      })

      ws.on('message', (data: WebSocket.RawData) => {
        try {
          const uint8 = new Uint8Array(data as ArrayBuffer)
          const decoder = decoding.createDecoder(uint8)
          const messageType = decoding.readVarUint(decoder)

          if (messageType === messageSync) {
            const encoder = encoding.createEncoder()
            encoding.writeVarUint(encoder, messageSync)
            syncProtocol.readSyncMessage(decoder, encoder, doc, ws)

            if (encoding.length(encoder) > 1) {
              ws.send(encoding.toUint8Array(encoder))
            }

            // Once we have received sync step 2 or update and document is synced
            if (!isSynced) {
              isSynced = true
              // Give Yjs a tick to ensure full doc state is applied
              setTimeout(() => {
                try {
                  const currentMarkdown = yFragmentToMarkdown(fragment)
                  const newMarkdown = modifier(currentMarkdown)

                  if (newMarkdown !== currentMarkdown) {
                    doc.transact(() => {
                      fragment.delete(0, fragment.length)
                      seedYFragmentFromMarkdown(newMarkdown, fragment)
                    }, 'mcp-client')
                  }

                  // Wait a brief moment for outgoing update frames to send
                  setTimeout(() => {
                    cleanup()
                    resolve(newMarkdown)
                  }, 300)
                } catch (err) {
                  cleanup()
                  reject(err)
                }
              }, 200)
            }
          }
        } catch (err) {
          cleanup()
          reject(err)
        }
      })

      ws.on('error', (err) => {
        cleanup()
        reject(err)
      })

      ws.on('close', (code, reason) => {
        if (!isSynced) {
          cleanup()
          reject(
            new Error(
              `Collab WebSocket closed before sync (code: ${code}, reason: ${reason.toString() || 'unknown'})`
            )
          )
        }
      })
    })
  }
}
