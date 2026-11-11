import { EditorState, Selection, TextSelection, Transaction } from "prosemirror-state";
import { Node as PMNode } from "prosemirror-model";

export const EXTERNAL_SYNC_META = "editorCoreExternalSync";

const MAX_PENDING_ECHOES = 32;

export interface ContentSyncTracker {
  lastEmitted: string;
  pendingEchoes: string[];
}

export function createSyncTracker(initialContent: string): ContentSyncTracker {
  return {
    lastEmitted: initialContent,
    pendingEchoes: [],
  };
}

export function resetSyncTracker(tracker: ContentSyncTracker, content: string): void {
  tracker.lastEmitted = content;
  tracker.pendingEchoes = [];
}

/**
 * Records a markdown snapshot emitted via `onChange` so the asynchronous React
 * prop echo is recognized even if multiple flushes occur before React commits.
 */
export function recordEmittedMarkdown(
  tracker: ContentSyncTracker,
  md: string,
  currentCommittedContent: string
): void {
  const expectedIncoming =
    tracker.pendingEchoes.length > 0
      ? tracker.pendingEchoes[tracker.pendingEchoes.length - 1]
      : currentCommittedContent;

  tracker.lastEmitted = md;
  if (md !== expectedIncoming) {
    tracker.pendingEchoes.push(md);
    if (tracker.pendingEchoes.length > MAX_PENDING_ECHOES) {
      tracker.pendingEchoes.shift();
    }
  }
}

export function consumeEchoIfKnown(
  tracker: ContentSyncTracker,
  incomingContent: string
): boolean {
  const echoIndex = tracker.pendingEchoes.indexOf(incomingContent);
  if (echoIndex !== -1) {
    tracker.pendingEchoes = tracker.pendingEchoes.slice(echoIndex + 1);
    return true;
  }
  if (incomingContent === tracker.lastEmitted) {
    tracker.pendingEchoes = [];
    return true;
  }
  return false;
}

/**
 * Replaces the full document content while keeping the selection clamped near
 * its previous position instead of letting ReplaceStep collapse it to the end.
 */
export function createExternalReplaceTransaction(
  state: EditorState,
  newDoc: PMNode
): Transaction {
  const prevAnchor = state.selection.anchor;
  const prevHead = state.selection.head;
  const tr = state.tr.replaceWith(0, state.doc.content.size, newDoc.content);
  const maxPos = tr.doc.content.size;

  const clampedAnchor = Math.max(0, Math.min(prevAnchor, maxPos));
  const clampedHead = Math.max(0, Math.min(prevHead, maxPos));

  try {
    if (clampedAnchor === clampedHead) {
      tr.setSelection(Selection.near(tr.doc.resolve(clampedHead), -1));
    } else {
      tr.setSelection(
        TextSelection.between(
          tr.doc.resolve(clampedAnchor),
          tr.doc.resolve(clampedHead)
        )
      );
    }
  } catch {
    try {
      tr.setSelection(Selection.near(tr.doc.resolve(clampedHead), -1));
    } catch {
      // Leave ProseMirror's default selection if resolving fails.
    }
  }

  tr.setMeta(EXTERNAL_SYNC_META, true);
  return tr;
}

export interface SyncIncomingOptions {
  state: EditorState;
  incomingContent: string;
  tracker: ContentSyncTracker;
  parseMarkdown: (md: string) => PMNode;
  serializeMarkdown: (doc: PMNode) => string;
}

export function resolveExternalContentSync({
  state,
  incomingContent,
  tracker,
  parseMarkdown,
  serializeMarkdown,
}: SyncIncomingOptions): Transaction | null {
  if (consumeEchoIfKnown(tracker, incomingContent)) {
    return null;
  }

  // Avoid reparsing when the current document already serializes identically
  // (e.g., an empty paragraph created by Enter does not round-trip identically).
  if (incomingContent === serializeMarkdown(state.doc)) {
    resetSyncTracker(tracker, incomingContent);
    return null;
  }

  const newDoc = parseMarkdown(incomingContent);
  resetSyncTracker(tracker, incomingContent);

  if (state.doc.eq(newDoc)) {
    return null;
  }

  return createExternalReplaceTransaction(state, newDoc);
}
