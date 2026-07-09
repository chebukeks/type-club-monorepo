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
