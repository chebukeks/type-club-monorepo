import { useEffect, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { Awareness } from "y-protocols/awareness";
import { getToken } from "../api";
import { config } from "../config";
import type { CollaborationConfig } from "@type-club/editor";

interface CollaborationState {
  config: CollaborationConfig | null;
  connected: boolean;
  synced: boolean;
  peers: number;
}

export function useCollaboration(
  articleId: number | null,
  user: { id?: number; nickname: string } | null,
  userRole?: string | null
): CollaborationState {
  const [collabConfig, setCollabConfig] = useState<CollaborationConfig | null>(null);
  const [connected, setConnected] = useState(false);
  const [synced, setSynced] = useState(false);
  const [peers, setPeers] = useState(0);

  useEffect(() => {
    if (!articleId) {
      setCollabConfig(null);
      setConnected(false);
      setSynced(false);
      setPeers(0);
      return;
    }

    setCollabConfig(null);
    setConnected(false);
    setSynced(false);
    setPeers(0);

    const ydoc = new Y.Doc();
    const yXmlFragment = ydoc.getXmlFragment("content");
    const awareness = new Awareness(ydoc);

    if (user) {
      awareness.setLocalStateField("user", {
        name: user.nickname,
        userId: user.id,
        role: userRole,
        color: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0"),
      });
    }

    const token = getToken() || "";
    const wsUrl = config.collabWsUrl;
    const roomName = `article-${articleId}`;
    const provider = new WebsocketProvider(
      wsUrl,
      roomName,
      ydoc,
      {
        awareness,
        params: { articleId: String(articleId), token },
      }
    );

    provider.on("status", (event: { status: string }) => {
      setConnected(event.status === "connected");
    });

    provider.on("sync", (isSynced: boolean) => {
      setSynced(isSynced);
    });

    const updatePeers = () => {
      const states = awareness.getStates();
      let count = 0;
      states.forEach((state) => {
        if (state.user && state.user.name) count++;
      });
      setPeers(count);
    };

    awareness.on("change", updatePeers);

    let destroyed = false;

    const destroyAll = () => {
      if (destroyed) return;
      destroyed = true;
      awareness.off("change", updatePeers);
      provider.disconnect();
      ydoc.destroy();
      setCollabConfig(null);
      setConnected(false);
      setSynced(false);
      setPeers(0);
    };

    setCollabConfig({
      yXmlFragment,
      awareness,
      destroy: destroyAll,
    });

    return () => {
      destroyAll();
    };
  }, [articleId]);

  useEffect(() => {
    if (!user || !collabConfig) return;
    collabConfig.awareness.setLocalStateField("user", {
      name: user.nickname,
      userId: user.id,
      role: userRole,
      color: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0"),
    });
  }, [user, userRole, collabConfig]);

  return { config: collabConfig, connected, synced, peers };
}
