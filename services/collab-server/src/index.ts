import { WebSocketServer, WebSocket } from "ws"
import * as Y from "yjs"
import * as encoding from "lib0/encoding"
import * as decoding from "lib0/decoding"
import {
  messageYjsSyncStep1,
  messageYjsSyncStep2,
  messageYjsUpdate,
} from "y-protocols/sync"
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from "y-protocols/awareness"

const PORT = parseInt(process.env.PORT || "8001", 10)

const messageSync = 0
const messageAwareness = 1

interface ClientInfo {
  userId: number
  nickname: string
  role: string
}

interface DocState {
  doc: Y.Doc
  awareness: Awareness
  clients: Map<WebSocket, ClientInfo>
  articleId: number
}

const states = new Map<number, DocState>()

function getOrCreateDoc(articleId: number): DocState {
  let state = states.get(articleId)
  if (!state) {
    const doc = new Y.Doc()
    const awareness = new Awareness(doc)
    state = { doc, awareness, clients: new Map(), articleId }
    states.set(articleId, state)

    awareness.on("update", ({ added, updated }: any, origin: any) => {
      const changed = [...added, ...updated]
      if (changed.length === 0) return
      const s = state!
      const payload = encodeAwarenessMessage(s.awareness, changed)
      s.clients.forEach((_, ws) => {
        if (ws !== origin && ws.readyState === WebSocket.OPEN) {
          ws.send(payload)
        }
      })
    })

    doc.on("update", (update: Uint8Array, origin: any) => {
      const s = state!
      const payload = encodeSyncMessage(update)
      s.clients.forEach((_, ws) => {
        if (ws !== origin && ws.readyState === WebSocket.OPEN) {
          ws.send(payload)
        }
      })
    })
  }
  return state
}

function encodeSyncMessage(update: Uint8Array): Buffer {
  const enc = encoding.createEncoder()
  encoding.writeVarUint(enc, messageSync)
  encoding.writeVarUint(enc, messageYjsUpdate)
  encoding.writeVarUint8Array(enc, update)
  return Buffer.from(encoding.toUint8Array(enc))
}

function encodeSyncStep1(doc: Y.Doc): Buffer {
  const enc = encoding.createEncoder()
  encoding.writeVarUint(enc, messageSync)
  encoding.writeVarUint(enc, messageYjsSyncStep1)
  encoding.writeVarUint8Array(enc, Y.encodeStateVector(doc))
  return Buffer.from(encoding.toUint8Array(enc))
}

function encodeSyncStep2(update: Uint8Array): Buffer {
  const enc = encoding.createEncoder()
  encoding.writeVarUint(enc, messageSync)
  encoding.writeVarUint(enc, messageYjsSyncStep2)
  encoding.writeVarUint8Array(enc, update)
  return Buffer.from(encoding.toUint8Array(enc))
}

function encodeAwarenessMessage(awareness: Awareness, changed: number[]): Buffer {
  const enc = encoding.createEncoder()
  encoding.writeVarUint(enc, messageAwareness)
  encoding.writeVarUint8Array(enc, encodeAwarenessUpdate(awareness, changed))
  return Buffer.from(encoding.toUint8Array(enc))
}

function getQueryParams(url: string | undefined): Record<string, string> {
  const params: Record<string, string> = {}
  if (!url) return params
  const q = url.split("?")[1]
  if (!q) return params
  for (const pair of q.split("&")) {
    const [k, v] = pair.split("=")
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || "")
  }
  return params
}

function heartbeat(ws: WebSocket) {
  const pingTimer = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping()
    }
  }, 30_000)
  ws.on("close", () => clearInterval(pingTimer))
  ws.on("error", () => clearInterval(pingTimer))
}

const wss = new WebSocketServer({
  port: PORT,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3,
    },
    zlibInflateOptions: { chunkSize: 10 * 1024 },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 10,
    concurrencyLimit: 10,
    threshold: 1024,
  },
})

wss.on("connection", async (ws, req) => {
  const params = getQueryParams(req.url)
  const articleId = parseInt(params.articleId, 10)
  const token = params.token || ""

  if (!articleId || isNaN(articleId) || !token) {
    ws.close(4001, "Missing articleId or token")
    return
  }

  const state = getOrCreateDoc(articleId)

  console.log(`[ws] connect article=${articleId} clients=${state.clients.size + 1}`)

  state.clients.set(ws, {
    userId: 0,
    nickname: "",
    role: "editor",
  })

  heartbeat(ws)

  ws.send(encodeSyncStep1(state.doc))

  ws.on("message", (data) => {
    try {
      const uint8 = new Uint8Array(
        data instanceof Buffer ? data : Buffer.from(data as ArrayBuffer),
      )
      const dec = decoding.createDecoder(uint8)
      const outerType = decoding.readVarUint(dec)

      if (outerType === messageSync) {
        const innerType = decoding.readVarUint(dec)
        console.log(`[ws] msg article=${articleId} type=sync subtype=${innerType}`)
        if (innerType === messageYjsUpdate) {
          const update = decoding.readVarUint8Array(dec)
          Y.applyUpdate(state.doc, update, ws)
        } else if (innerType === messageYjsSyncStep1) {
          const sv = decoding.readVarUint8Array(dec)
          const missing = Y.encodeStateAsUpdate(state.doc, sv)
          console.log(`[ws] syncStep1 article=${articleId} svLen=${sv.length} missingLen=${missing.length}`)
          if (missing.length > 2) {
            ws.send(encodeSyncStep2(missing))
          }
        } else if (innerType === messageYjsSyncStep2) {
          const update = decoding.readVarUint8Array(dec)
          Y.applyUpdate(state.doc, update, ws)
        }
      } else if (outerType === messageAwareness) {
        console.log(`[ws] msg article=${articleId} type=awareness`)
        const awarenessUpdate = decoding.readVarUint8Array(dec)
        applyAwarenessUpdate(state.awareness, awarenessUpdate, ws)
      }
    } catch (err) {
      console.error("[ws] message error:", err)
    }
  })

  ws.on("close", (code, reason) => {
    state.clients.delete(ws)
    console.log(`[ws] disconnect article=${articleId} clients=${state.clients.size} code=${code} reason=${reason}`)
    if (state.clients.size === 0) {
      setTimeout(() => {
        if (state.clients.size === 0) {
          states.delete(articleId)
          state.doc.destroy()
        }
      }, 60_000)
    }
  })

  ws.on("error", (err) => {
    console.error(`[ws] error article=${articleId}:`, err.message)
  })
})

wss.on("listening", () => {
  console.log(`[collab-server] listening on port ${PORT}`)
})
