/**
 * collabSync.ts — Yjs XmlFragment ↔ Markdown conversion for the collab-server.
 *
 * IMPORTANT: all ProseMirror work here must stay on a SINGLE prosemirror-model
 * instance. In the collab-server's Node/tsx runtime, prosemirror-model can be
 * loaded twice (ESM `dist/index.js` via imports + CJS `dist/index.cjs` via
 * `require` from y-prosemirror / prosemirror-tables). Passing nodes across
 * instances trips prosemirror's "multiple versions" guard.
 *
 * To avoid that we NEVER call the JSON-based `Node.fromJSON(schema, …)` /
 * `prosemirrorJSONToYXmlFragment` (those cross instances). Instead:
 *   - seed:    parseMarkdown() -> prosemirrorToYXmlFragment(doc, fragment)
 *              (doc-based; only reads the PM doc, builds Y types)
 *   - extract: yXmlFragmentToProsemirrorJSON() -> schema.nodeFromJSON()
 *              (bound to the schema's OWN module Node) -> serializeMarkdown()
 */
import { prosemirrorToYXmlFragment, yXmlFragmentToProsemirrorJSON } from "y-prosemirror"
import type * as Y from "yjs"
import { schema } from "./schema"
import { parseMarkdown, serializeMarkdown } from "./markdownConfig"
import { visitTasks } from "./taskIdentity"

/** Populate an (expected empty) Y.XmlFragment from a markdown string. */
export function seedYFragmentFromMarkdown(markdown: string, fragment: Y.XmlFragment): void {
  const doc = parseMarkdown(markdown)
  prosemirrorToYXmlFragment(doc, fragment)
}

/** Convert a Y.XmlFragment (attached to a Y.Doc) into a markdown string. */
export function yFragmentToMarkdown(fragment: Y.XmlFragment): string {
  const json = yXmlFragmentToProsemirrorJSON(fragment)
  const doc = schema.nodeFromJSON(json)
  return serializeMarkdown(doc)
}

/** Update one task in-place, preserving the rest of the live CRDT. */
export function setTaskState(fragment: Y.XmlFragment, taskId: string, checked: boolean): boolean {
  const doc = schema.nodeFromJSON(yXmlFragmentToProsemirrorJSON(fragment))
  const taskIds: string[] = []
  visitTasks(doc, (_node, _pos, id) => taskIds.push(id))
  const target = taskIds.indexOf(taskId)
  if (target === -1) return false

  let index = 0
  const update = (parent: Y.XmlFragment): boolean => {
    for (const child of parent.toArray()) {
      if (!("nodeName" in child)) continue
      const task = child as Y.XmlElement<{ checked: boolean }>
      if (task.nodeName === 'list_item' && typeof task.getAttribute('checked') === 'boolean' && index++ === target) {
        if (task.getAttribute('checked') !== checked) task.setAttribute('checked', checked)
        return true
      }
      if (update(child)) return true
    }
    return false
  }
  return update(fragment)
}
