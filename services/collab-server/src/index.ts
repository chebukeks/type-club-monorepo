import { WebSocketServer, WebSocket } from "ws"
import * as Y from "yjs"
import * as encoding from "lib0/encoding"
import * as decoding from "lib0/decoding"
import * as fs from "fs"
import * as path from "path"
import {
  messageYjsSyncStep1,
  messageYjsSyncStep2,
  messageYjsUpdate,
} from "y-protocols/sync"
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from "y-protocols/awareness"
import { seedYFragmentFromMarkdown, yFragmentToMarkdown } from "@type-club/editor/src/editor/collabSync"

const PORT = parseInt(process.env.PORT || "8001", 10)
const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/$/, "")
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || ""

if (!SERVICE_TOKEN) {
  console.error("[collab-server] SERVICE_TOKEN is required, exiting")
  process.exit(1)
}

// Delay after last edit before persisting to the DB.
const SAVE_DEBOUNCE_MS = parseInt(process.env.SAVE_DEBOUNCE_MS || "8000", 10)
// Max consecutive auto-retries of a failed save (avoids hot-looping).
const MAX_SAVE_RETRIES = 5
// Keep the in-memory doc alive this long after the last client leaves (15 mins).
const DOC_TTL_MS = parseInt(process.env.DOC_TTL_MS || "900000", 10)
// Yjs XmlFragment key — MUST match the client (useCollaboration.ts).
const FRAGMENT_KEY = "content"

// Directory for persisting Yjs binary CRDT snapshots on disk across doc evictions/restarts.
const STORAGE_DIR = process.env.STORAGE_DIR || path.resolve(process.cwd(), "storage")
try {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true })
  }
} catch (err) {
  console.warn("[storage] failed to create storage dir:", err)
}

function getDocFilePath(articleId: number): string {
  return path.join(STORAGE_DIR, `article-${articleId}.ydoc`)
}

function loadDocFromDisk(state: DocState): boolean {
  try {
    const filePath = getDocFilePath(state.articleId)
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath)
      if (data.length > 0) {
        Y.applyUpdate(state.doc, new Uint8Array(data))
        state.seeded = true
        console.log(`[storage] article=${state.articleId} restored from disk (${data.length} bytes)`)
        return true
      }
    }
  } catch (err) {
    console.error(`[storage] article=${state.articleId} failed to read disk state:`, err)
  }
  return false
}

function saveDocToDisk(state: DocState): void {
  try {
    const filePath = getDocFilePath(state.articleId)
    const update = Y.encodeStateAsUpdate(state.doc)
    if (update.length > 0) {
      fs.writeFileSync(filePath, Buffer.from(update))
    }
  } catch (err) {
    console.error(`[storage] article=${state.articleId} failed to write disk state:`, err)
  }
}

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
  seeded: boolean
  dirty: boolean
  saving: boolean
  saveFailures: number
  saveTimer: NodeJS.Timeout | null
  destroyTimer: NodeJS.Timeout | null
}

const states = new Map<number, DocState>()

function getOrCreateDoc(articleId: number): DocState {
  let state = states.get(articleId)
  if (state) return state

  const doc = new Y.Doc()
  const awareness = new Awareness(doc)
  const newState: DocState = {
    doc,
    awareness,
    clients: new Map(),
    articleId,
    seeded: false,
    dirty: false,
    saving: false,
    saveFailures: 0,
    saveTimer: null,
    destroyTimer: null,
  }
  state = newState
  states.set(articleId, state)

  awareness.on("update", ({ added, updated }: any, origin: any) => {
    const changed = [...added, ...updated]
    if (changed.length === 0) return
    const payload = encodeAwarenessMessage(newState.awareness, changed)
    newState.clients.forEach((_, ws) => {
      if (ws !== origin && ws.readyState === WebSocket.OPEN) {
        ws.send(payload)
      }
    })
  })

  doc.on("update", (update: Uint8Array, origin: any) => {
    const payload = encodeSyncMessage(update)
    newState.clients.forEach((_, ws) => {
      if (ws !== origin && ws.readyState === WebSocket.OPEN) {
        ws.send(payload)
      }
    })
    // Only persist real edits — not the initial seed (origin === undefined
    // during seeding, and `seeded` is still false at that point).
    if (newState.seeded && origin) {
      scheduleSave(newState)
    }
  })

  // First, attempt to restore from local disk cache
  const loadedFromDisk = loadDocFromDisk(newState)
  if (loadedFromDisk) {
    newState.seeded = true
  }

  return state
}

// ── Seeding: DB markdown → Yjs XmlFragment (once, on first open) ──

async function seedFromBackend(state: DocState): Promise<void> {
  const fragment = state.doc.getXmlFragment(FRAGMENT_KEY)
  if (fragment.length > 0) {
    state.seeded = true
    return
  }
  try {
    const res = await fetch(`${BACKEND_URL}/api/articles/${state.articleId}/content`, {
      headers: { Authorization: `Bearer ${SERVICE_TOKEN}` },
    })
    if (!res.ok) {
      console.error(`[seed] article=${state.articleId} backend responded ${res.status}`)
      return
    }
    const data = (await res.json()) as { content?: string }
    if (fragment.length === 0) {
      seedYFragmentFromMarkdown(data.content || "", fragment)
      console.log(`[seed] article=${state.articleId} seeded ${(data.content || "").length} chars`)
      saveDocToDisk(state)
    }
  } catch (err) {
    console.error(`[seed] article=${state.articleId} error:`, err)
  } finally {
    state.seeded = true
  }
}

// ── Persistence: Yjs XmlFragment → markdown → DB ──

function scheduleSave(state: DocState): void {
  state.dirty = true
  if (state.saveTimer) return
  state.saveTimer = setTimeout(() => {
    state.saveTimer = null
    void persist(state)
  }, SAVE_DEBOUNCE_MS)
}

async function persist(state: DocState): Promise<void> {
  if (!state.dirty) return
  if (state.saving) {
    // A save is already in flight; make sure another one runs afterwards.
    scheduleSave(state)
    return
  }
  state.saving = true
  state.dirty = false
  try {
    const fragment = state.doc.getXmlFragment(FRAGMENT_KEY)
    if (fragment.length === 0) {
      // Never clobber a real article with an empty doc (e.g. failed seed).
      return
    }
    const content = yFragmentToMarkdown(fragment)
    saveDocToDisk(state)

    const res = await fetch(`${BACKEND_URL}/api/articles/${state.articleId}/sync-state`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_TOKEN}`,
      },
      body: JSON.stringify({ content }),
    })
    if (!res.ok) {
      console.error(`[persist] article=${state.articleId} backend responded ${res.status}`)
      retryPersist(state)
    } else {
      state.saveFailures = 0
      console.log(`[persist] article=${state.articleId} saved ${content.length} chars`)
    }
  } catch (err) {
    console.error(`[persist] article=${state.articleId} error:`, err)
    retryPersist(state)
  } finally {
    state.saving = false
  }
}

// Re-arm a failed save with a cap, so a persistent error can't hot-loop.
function retryPersist(state: DocState): void {
  state.saveFailures += 1
  if (state.saveFailures > MAX_SAVE_RETRIES) {
    console.error(`[persist] article=${state.articleId} giving up after ${state.saveFailures} failures`)
    return
  }
  state.dirty = true
  scheduleSave(state)
}

async function flush(state: DocState): Promise<void> {
  if (state.saveTimer) {
    clearTimeout(state.saveTimer)
    state.saveTimer = null
  }
  if (state.dirty) {
    await persist(state)
  } else {
    saveDocToDisk(state)
  }
}

// ── Message encoding helpers ──

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

function handleMessage(state: DocState, ws: WebSocket, uint8: Uint8Array): void {
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
      // Always reply with syncStep2 (even when the diff is empty) so the client
      // reliably flips to `synced` — including on reconnect / already-synced.
      ws.send(encodeSyncStep2(missing))
    } else if (innerType === messageYjsSyncStep2) {
      const update = decoding.readVarUint8Array(dec)
      Y.applyUpdate(state.doc, update, ws)
    }
  } else if (outerType === messageAwareness) {
    const awarenessUpdate = decoding.readVarUint8Array(dec)
    applyAwarenessUpdate(state.awareness, awarenessUpdate, ws)
  }
}

// ── Utilities ──

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

// ── Server ──

const MAX_PAYLOAD_BYTES = 1 * 1024 * 1024 // 1 MB
const MAX_CONNECTIONS_PER_IP = 25

const connectionsByIP = new Map<string, number>()

function getClientIP(req: any): string {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown"
  )
}

const wss = new WebSocketServer({
  port: PORT,
  maxPayload: MAX_PAYLOAD_BYTES,
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
  const clientIP = getClientIP(req)
  const currentConns = connectionsByIP.get(clientIP) || 0
  if (currentConns >= MAX_CONNECTIONS_PER_IP) {
    ws.close(4029, "Too many connections from this IP")
    return
  }
  connectionsByIP.set(clientIP, currentConns + 1)

  ws.on("close", () => {
    const count = connectionsByIP.get(clientIP) || 1
    if (count <= 1) connectionsByIP.delete(clientIP)
    else connectionsByIP.set(clientIP, count - 1)
  })

  const params = getQueryParams(req.url)
  const articleId = parseInt(params.articleId, 10)
  const token = params.token || ""

  if (!articleId || isNaN(articleId) || !token) {
    ws.close(4001, "Missing articleId or token")
    return
  }

  // Buffer messages immediately so that incoming client frames (like initial syncStep1)
  // are captured even while authentication and document initialization are in flight.
  let initialized = false
  const pending: Uint8Array[] = []
  let docState: DocState | null = null

  heartbeat(ws)

  ws.on("message", (data) => {
    try {
      const uint8 = new Uint8Array(
        data instanceof Buffer ? data : Buffer.from(data as ArrayBuffer),
      )
      if (!initialized || !docState) {
        pending.push(uint8)
        return
      }
      handleMessage(docState, ws, uint8)
    } catch (err) {
      console.error("[ws] message error:", err)
    }
  })

  ws.on("close", (code, reason) => {
    if (docState) {
      docState.clients.delete(ws)
      console.log(`[ws] disconnect article=${articleId} clients=${docState.clients.size} code=${code} reason=${reason}`)
      if (docState.clients.size === 0) {
        void flush(docState)
        docState.destroyTimer = setTimeout(() => {
          if (docState && docState.clients.size === 0) {
            states.delete(articleId)
            docState.doc.destroy()
          }
        }, DOC_TTL_MS)
      }
    } else {
      console.log(`[ws] disconnect before auth article=${articleId} code=${code} reason=${reason}`)
    }
  })

  ws.on("error", (err) => {
    console.error(`[ws] error article=${articleId}:`, err.message)
  })

  // Verify JWT token & user role against backend
  let verifiedUserId = 0
  let verifiedNickname = ""
  let verifiedRole = "editor"

  try {
    const meRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!meRes.ok) {
      ws.close(4003, "Invalid authentication token")
      return
    }
    const meData = (await meRes.json()) as { id: number; nickname: string }
    verifiedUserId = meData.id
    verifiedNickname = meData.nickname

    const roleRes = await fetch(
      `${BACKEND_URL}/api/articles/${articleId}/user-role?user_id=${verifiedUserId}`,
      {
        headers: { Authorization: `Bearer ${SERVICE_TOKEN}` },
      }
    )
    if (!roleRes.ok) {
      ws.close(4003, "Access denied for this article")
      return
    }
    const roleData = (await roleRes.json()) as { role: string }
    verifiedRole = roleData.role
  } catch (err) {
    console.error(`[ws] auth error for article=${articleId}:`, err)
    ws.close(4003, "Authentication verification failed")
    return
  }

  const state = getOrCreateDoc(articleId)
  docState = state
  if (state.destroyTimer) {
    clearTimeout(state.destroyTimer)
    state.destroyTimer = null
  }

  console.log(
    `[ws] connect article=${articleId} user=${verifiedNickname}(id=${verifiedUserId}, role=${verifiedRole}) clients=${state.clients.size + 1}`
  )

  state.clients.set(ws, {
    userId: verifiedUserId,
    nickname: verifiedNickname,
    role: verifiedRole,
  })

  // Smart Seeding:
  // If the document has not yet been seeded (neither in-memory nor from disk):
  if (!state.seeded) {
    let clientHasState = false
    for (const msg of pending) {
      try {
        const dec = decoding.createDecoder(msg)
        const outer = decoding.readVarUint(dec)
        if (outer === messageSync) {
          const inner = decoding.readVarUint(dec)
          if (inner === messageYjsSyncStep1) {
            const sv = decoding.readVarUint8Array(dec)
            const decodedSV = Y.decodeStateVector(sv)
            if (decodedSV.size > 0) {
              clientHasState = true
              break
            }
          }
        }
      } catch (err) {
        // ignore decoding errors
      }
    }

    if (clientHasState) {
      console.log(`[ws] article=${articleId} client has existing Yjs state (${clientHasState}), skipping DB seed to prevent duplication`)
      state.seeded = true
    } else {
      await seedFromBackend(state)
    }
  }

  if (ws.readyState !== WebSocket.OPEN) return

  ws.send(encodeSyncStep1(state.doc))

  initialized = true
  for (const msg of pending) {
    try {
      handleMessage(state, ws, msg)
    } catch (err) {
      console.error("[ws] buffered message error:", err)
    }
  }
  pending.length = 0
})

wss.on("listening", () => {
  console.log(`[collab-server] listening on port ${PORT}`)
})

async function shutdown() {
  console.log("[collab-server] shutting down, flushing docs...")
  await Promise.allSettled([...states.values()].map((s) => flush(s)))
  process.exit(0)
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)
