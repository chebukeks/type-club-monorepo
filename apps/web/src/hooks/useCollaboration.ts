import { useEffect, useState } from "react"
import * as Y from "yjs"
import { WebsocketProvider } from "y-websocket"
import { Awareness } from "y-protocols/awareness"
import { getToken } from "../api"
import type { CollaborationConfig } from "@type-club/editor"

interface CollaborationState {
  config: CollaborationConfig | null
  connected: boolean
  synced: boolean
  peers: number
}

export function useCollaboration(
  articleId: number | null,
  user: { id?: number; nickname: string } | null,
  userRole?: string | null
): CollaborationState {
  const [activeArticleId, setActiveArticleId] = useState<number | null>(null)
  const [collabConfig, setCollabConfig] = useState<CollaborationConfig | null>(null)
  const [connected, setConnected] = useState(false)
  const [synced, setSynced] = useState(false)
  const [peers, setPeers] = useState(0)

  useEffect(() => {
    if (!articleId) {
      setActiveArticleId(null)
      setCollabConfig(null)
      setConnected(false)
      setSynced(false)
      setPeers(0)
      return
    }

    setActiveArticleId(null)
    setCollabConfig(null)
    setConnected(false)
    setSynced(false)
    setPeers(0)

    const ydoc = new Y.Doc()
    const yXmlFragment = ydoc.getXmlFragment("content")
    const awareness = new Awareness(ydoc)

    if (user) {
      awareness.setLocalStateField("user", {
        name: user.nickname,
        userId: user.id,
        role: userRole,
        color: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0"),
      })
    }

    const token = getToken() || ""
    const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:"
    const wsUrl = `${wsProtocol}//${location.host}/collab`
    const roomName = `article-${articleId}`
    const provider = new WebsocketProvider(
      wsUrl,
      roomName,
      ydoc,
      {
        awareness,
        params: { articleId: String(articleId), token },
      },
    )

    provider.on("status", (event: { status: string }) => {
      setConnected(event.status === "connected")
    })

    provider.on("sync", (isSynced: boolean) => {
      setSynced(isSynced)
    })

    const updatePeers = () => {
      const states = awareness.getStates()
      let count = 0
      states.forEach((state) => {
        if (state.user && state.user.name) count++
      })
      setPeers(count)
    }

    awareness.on("change", updatePeers)

    let destroyed = false

    const destroyAll = () => {
      if (destroyed) return
      destroyed = true
      awareness.off("change", updatePeers)
      provider.disconnect()
      ydoc.destroy()
      setActiveArticleId(null)
      setCollabConfig(null)
      setConnected(false)
      setSynced(false)
      setPeers(0)
    }

    setActiveArticleId(articleId)
    setCollabConfig({
      yXmlFragment,
      awareness,
      destroy: destroyAll,
    })

    return () => {
      destroyAll()
    }
  }, [articleId])

  useEffect(() => {
    if (!user || !collabConfig || activeArticleId !== articleId) return
    collabConfig.awareness.setLocalStateField("user", {
      name: user.nickname,
      userId: user.id,
      role: userRole,
      color: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0"),
    })
  }, [user, userRole, collabConfig, activeArticleId, articleId])

  const effectiveConfig = (activeArticleId === articleId && articleId !== null) ? collabConfig : null

  return {
    config: effectiveConfig,
    connected: activeArticleId === articleId ? connected : false,
    synced: activeArticleId === articleId ? synced : false,
    peers: activeArticleId === articleId ? peers : 0,
  }
}
