import { Plugin } from "prosemirror-state"
import { ySyncPlugin, yUndoPlugin, yCursorPlugin } from "y-prosemirror"
import type { Awareness } from "y-protocols/awareness"
import type * as Y from "yjs"

export interface CollaborationConfig {
  yXmlFragment: Y.XmlFragment
  awareness: Awareness
  destroy: () => void
}

export function createCollaborationPlugins(config: CollaborationConfig): Plugin[] {
  const { yXmlFragment, awareness } = config
  return [
    ySyncPlugin(yXmlFragment),
    yUndoPlugin(),
    yCursorPlugin(awareness),
  ]
}
