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
const BACKEND_URL = process.env.BACKEND_URL || "http://type-club-backend:8000"
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || ""

const messageSync = 0
const messageAwareness = 1

function serviceHeaders(): Record<string, string> {
  return SERVICE_TOKEN ? { Authorization: `Bearer ${SERVICE_TOKEN}` } : {}
}

let persistTimer: ReturnType<typeof setInterval> | null = null

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

async function jsonFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options?.headers as Record<string, string>) },
    ...options,
  })
  if (!res.ok) return null
  return res.json()
}

async function validateToken(token: string): Promise<{ userId: number; nickname: string } | null> {
  try {
    const user = await jsonFetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!user) return null
    return { userId: user.id, nickname: user.nickname }
  } catch {
    return null
  }
}

async function checkAccess(
  articleId: number,
  userId: number,
): Promise<{ hasAccess: boolean; role: string }> {
  try {
    const data = await jsonFetch(`/api/articles/${articleId}/check-access`, {
      headers: { "X-User-Id": String(userId), ...serviceHeaders() },
    })
    if (!data) return { hasAccess: false, role: "" }
    return { hasAccess: data.has_access, role: data.role || "editor" }
  } catch {
    return { hasAccess: false, role: "" }
  }
}

async function persistArticle(state: DocState) {
  try {
    const content = state.doc.getText("content").toString()
    await jsonFetch(`/api/articles/${state.articleId}/sync-state`, {
      method: "PATCH",
      headers: serviceHeaders(),
      body: JSON.stringify({ content }),
    })
  } catch (err) {
    console.error(`[persist] article ${state.articleId} error:`, err)
  }
}

function startPersistLoop() {
  if (persistTimer) return
  persistTimer = setInterval(() => {
    for (const state of states.values()) {
      if (state.clients.size > 0) {
        persistArticle(state)
      }
    }
  }, 30_000)
}

async function loadArticleContent(state: DocState) {
  try {
    const data = await jsonFetch(`/api/articles/${state.articleId}/content`, {
      headers: serviceHeaders(),
    })
    if (!data) return
    if (data.content) {
      state.doc.getText("content").insert(0, data.content)
    }
  } catch (err) {
    console.error(`[load] article ${state.articleId} error:`, err)
  }
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

const wss = new WebSocketServer({ port: PORT })

wss.on("connection", async (ws, req) => {
  const params = getQueryParams(req.url)
  const articleId = parseInt(params.articleId, 10)
  const token = params.token || ""

  if (!articleId || isNaN(articleId) || !token) {
    ws.close(4001, "Missing articleId or token")
    return
  }

  const user = await validateToken(token)
  if (!user) {
    ws.close(4002, "Invalid token")
    return
  }

  const access = await checkAccess(articleId, user.userId)
  if (!access.hasAccess) {
    ws.close(4003, "Access denied")
    return
  }

  const state = getOrCreateDoc(articleId)

  if (state.clients.size === 0) {
    await loadArticleContent(state)
  }

  state.clients.set(ws, { userId: user.userId, nickname: user.nickname, role: access.role })

  startPersistLoop()
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
        if (innerType === messageYjsUpdate) {
          const update = decoding.readVarUint8Array(dec)
          Y.applyUpdate(state.doc, update, ws)
        } else if (innerType === messageYjsSyncStep1) {
          const sv = decoding.readVarUint8Array(dec)
          const missing = Y.encodeStateAsUpdate(state.doc, sv)
          if (missing.length > 2) {
            ws.send(encodeSyncStep2(missing))
          }
        } else if (innerType === messageYjsSyncStep2) {
          const update = decoding.readVarUint8Array(dec)
          Y.applyUpdate(state.doc, update, ws)
        }
      } else if (outerType === messageAwareness) {
        const awarenessUpdate = decoding.readVarUint8Array(dec)
        applyAwarenessUpdate(state.awareness, awarenessUpdate, ws)
      }
    } catch (err) {
      console.error("[ws] message error:", err)
    }
  })

  ws.on("close", () => {
    state.clients.delete(ws)
    if (state.clients.size === 0) {
      persistArticle(state)
      setTimeout(() => {
        if (state.clients.size === 0) {
          states.delete(articleId)
          state.doc.destroy()
          if (states.size === 0 && persistTimer) {
            clearInterval(persistTimer)
            persistTimer = null
          }
        }
      }, 60_000)
    }
  })

  ws.on("error", (err) => {
    console.error(`[ws] error article=${articleId} user=${user.nickname}:`, err.message)
  })
})

wss.on("listening", () => {
  console.log(`[collab-server] listening on port ${PORT}`)
})

console.log(`[collab-server] backend: ${BACKEND_URL}`)
