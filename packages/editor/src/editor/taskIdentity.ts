import type { Node as PMNode } from 'prosemirror-model'

export function visitTasks(doc: PMNode, visit: (node: PMNode, pos: number, id: string) => void) {
  const occurrences = new Map<string, number>()
  doc.descendants((node, pos) => {
    if (node.type.name !== 'list_item' || typeof node.attrs.checked !== 'boolean') return
    const label = node.firstChild?.textContent.trim() ?? ''
    let hash = 2166136261
    for (let i = 0; i < label.length; i++) hash = Math.imul(hash ^ label.charCodeAt(i), 16777619)
    const base = `${label.length}:${hash >>> 0}`
    const occurrence = occurrences.get(base) ?? 0
    occurrences.set(base, occurrence + 1)
    visit(node, pos, `${base}:${occurrence}`)
  })
}
