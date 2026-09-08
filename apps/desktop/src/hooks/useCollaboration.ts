import { useEffect, useState, useMemo } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { Awareness } from "y-protocols/awareness";
import { getToken } from "../api";
import { config } from "../config";
import type { CollaborationConfig } from "@type-club/editor";

interface CollaborationState {
  config: CollaborationConfig | null;
  connected: boolean;
  status: 'connected' | 'connecting' | 'disconnected';
  synced: boolean;
  peers: number;
}

export function useCollaboration(
  articleId: number | null,
  user: { id?: number; nickname: string } | null,
  userRole?: string | null
): CollaborationState {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [synced, setSynced] = useState(false);
  const [peers, setPeers] = useState(0);

  const collabObj = useMemo(() => {
    if (!articleId) return null;

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

    let destroyed = false;
    const destroyAll = () => {
      if (destroyed) return;
      destroyed = true;
      provider.disconnect();
      ydoc.destroy();
    };

    const configObj: CollaborationConfig = {
      yXmlFragment,
      awareness,
      destroy: destroyAll,
    };

    return { configObj, provider, awareness, articleId };
  }, [articleId]);

  useEffect(() => {
    if (!collabObj) {
      setConnected(false);
      setSynced(false);
      setPeers(0);
      return;
    }

    const { provider, awareness } = collabObj;

    const onStatus = (event: { status: string }) => {
      const s = event.status as 'connected' | 'connecting' | 'disconnected';
      setStatus(s);
      setConnected(s === "connected");
    };
    const onSync = (isSynced: boolean) => {
      setSynced(isSynced);
    };
    const updatePeers = () => {
      const states = awareness.getStates();
      let count = 0;
      states.forEach((state) => {
        if (state.user && state.user.name) count++;
      });
      setPeers(count);
    };

    provider.on("status", onStatus);
    provider.on("sync", onSync);
    awareness.on("change", updatePeers);

    return () => {
      provider.off("status", onStatus);
      provider.off("sync", onSync);
      awareness.off("change", updatePeers);
      collabObj.configObj.destroy();
    };
  }, [collabObj]);

  useEffect(() => {
    if (!user || !collabObj) return;
    collabObj.awareness.setLocalStateField("user", {
      name: user.nickname,
      userId: user.id,
      role: userRole,
      color: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0"),
    });
  }, [user, userRole, collabObj]);

  return {
    config: collabObj ? collabObj.configObj : null,
    connected,
    status,
    synced,
    peers,
  };
}
