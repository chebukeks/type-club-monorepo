import { useEffect, useRef, useState } from "react"
import * as Y from "yjs"
import { WebsocketProvider } from "y-websocket"
import { Awareness } from "y-protocols/awareness"
import { getToken } from "../api"
import type { CollaborationConfig } from "@type-club/editor"

interface CollaborationState {
  config: CollaborationConfig | null
  connected: boolean
  peers: number
}

export function useCollaboration(articleId: number | null): CollaborationState {
  const [connected, setConnected] = useState(false)
  const [peers, setPeers] = useState(0)
  const yFragmentRef = useRef<Y.XmlFragment | null>(null)
  const awarenessRef = useRef<Awareness | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)
  const ydocRef = useRef<Y.Doc | null>(null)
  const destroyRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!articleId) return

    const ydoc = new Y.Doc()
    ydocRef.current = ydoc

    const yXmlFragment = ydoc.getXmlFragment("content")
    yFragmentRef.current = yXmlFragment

    const awareness = new Awareness(ydoc)
    awarenessRef.current = awareness

    const token = getToken() || ""
    const provider = new WebsocketProvider(
      "wss://type-club.ru/collab",
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
      awareness.destroy()
      ydoc.destroy()
      yFragmentRef.current = null
      awarenessRef.current = null
      setConnected(false)
      setPeers(0)
    }

    destroyRef.current = destroyAll

    return () => {
      destroyAll()
    }
  }, [articleId])

  if (!articleId || !yFragmentRef.current || !awarenessRef.current) {
    return { config: null, connected: false, peers: 0 }
  }

  return {
    config: {
      yXmlFragment: yFragmentRef.current,
      awareness: awarenessRef.current,
      destroy: () => destroyRef.current?.(),
    },
    connected,
    peers,
  }
}
