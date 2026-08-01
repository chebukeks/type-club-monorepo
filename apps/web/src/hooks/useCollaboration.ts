import { useEffect, useMemo, useRef, useState } from "react"
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
  const [connected, setConnected] = useState(false)
  const [synced, setSynced] = useState(false)
  const [peers, setPeers] = useState(0)
  const [ready, setReady] = useState(false)
  const yFragmentRef = useRef<Y.XmlFragment | null>(null)
  const awarenessRef = useRef<Awareness | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)
  const ydocRef = useRef<Y.Doc | null>(null)
  const destroyRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!articleId) return

    setReady(false)

    const ydoc = new Y.Doc()
    ydocRef.current = ydoc

    const yXmlFragment = ydoc.getXmlFragment("content")
    yFragmentRef.current = yXmlFragment

    const awareness = new Awareness(ydoc)
    awarenessRef.current = awareness

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
    const provider = new WebsocketProvider(
      wsUrl,
      "article",
      ydoc,
      {
        awareness,
        params: { articleId: String(articleId), token },
      },
    )
    providerRef.current = provider

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
      yFragmentRef.current = null
      awarenessRef.current = null
      setReady(false)
      setConnected(false)
      setSynced(false)
      setPeers(0)
    }

    destroyRef.current = destroyAll

    setReady(true)

    return () => {
      destroyAll()
    }
  }, [articleId])

  useEffect(() => {
    if (!user || !awarenessRef.current) return
    awarenessRef.current.setLocalStateField("user", {
      name: user.nickname,
      userId: user.id,
      role: userRole,
      color: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0"),
    })
  }, [user, userRole])

  const config = useMemo<CollaborationConfig | null>(() => {
    if (!ready || !yFragmentRef.current || !awarenessRef.current) return null
    return {
      yXmlFragment: yFragmentRef.current,
      awareness: awarenessRef.current,
      destroy: () => destroyRef.current?.(),
    }
  }, [ready])

  return { config, connected, synced, peers }
}
