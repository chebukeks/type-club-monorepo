import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from "y-protocols/awareness";
import { ySyncPluginKey } from "y-prosemirror";
import { Plugin } from "prosemirror-state";
import { EditorCore, seedYFragmentFromMarkdown } from "@type-club/editor";
import type { CollaborationConfig, TranslationKey } from "@type-club/editor";
import { useLanguage } from "../context/LanguageContext";

/**
 * Landing-page playground: a real Type Club editor running a local, in-memory
 * Yjs session (no collab server, nothing persisted). A simulated co-author
 * types and erases phrases next to the visitor through a second Y.Doc that is
 * synced in the browser, so her caret is rendered by the same yCursorPlugin as
 * in real collaboration.
 */

const PEER_ORIGIN = "landing-demo-peer";
const PEER_COLOR = "#db2777";
/** Peer stays paused while the visitor is typing and for this long after. */
const USER_IDLE_MS = 2000;

const DEMO_STYLES = `
.tc-live-demo > div {
  overflow-anchor: none;
}
.tc-live-demo .ProseMirror {
  padding: 14px 16px 16px;
  overflow-anchor: none;
}
@media (min-width: 640px) {
  .tc-live-demo .ProseMirror {
    padding: 22px 36px 24px;
  }
}
.tc-live-demo .ProseMirror > h1:first-child {
  margin-top: 0;
  font-size: 1.65em;
}
.tc-live-demo .ProseMirror p {
  min-height: 1.75em;
}
.tc-live-demo .ProseMirror p:last-child {
  margin-bottom: 0;
}
.tc-live-demo .math-block-wrapper {
  margin: 8px 0;
}
.tc-live-demo .math-block-preview-wrapper {
  padding: 6px 12px;
}
.tc-live-demo .katex-display {
  margin: 0.25em 0;
}
.tc-live-demo .code-block-wrapper {
  margin: 10px 0;
}
.tc-live-demo .ProseMirror .code-block-wrapper pre {
  padding: 12px 16px;
}
.tc-live-demo .ProseMirror-yjs-cursor {
  border-left: 2px solid;
  margin-left: -1px;
  margin-right: -1px;
}
`;

function buildInitialMarkdown(t: (key: TranslationKey) => string): string {
  return [
    `# ${t("landing.previewDocTitle")}`,
    "",
    t("landing.previewLead"),
    "",
    "$$",
    "|\\psi\\rangle = \\alpha |0\\rangle + \\beta |1\\rangle, \\quad |\\alpha|^2 + |\\beta|^2 = 1",
    "$$",
    "",
    "```typescript",
    "export interface QubitState {",
    "  readonly alpha: Complex;",
    "  readonly beta: Complex;",
    "  measure(): 0 | 1;",
    "}",
    "```",
    "",
    t("landing.demoTryIt"),
    "",
  ].join("\n");
}

/** Plain text of a Y.XmlText with embeds as single placeholder chars (keeps Yjs indices). */
function plainText(text: Y.XmlText): string {
  return text
    .toDelta()
    .map((op: { insert?: unknown }) => (typeof op.insert === "string" ? op.insert : "\uFFFC"))
    .join("");
}

function isParagraph(node: unknown): node is Y.XmlElement {
  return node instanceof Y.XmlElement && node.nodeName === "paragraph";
}

interface PeerOptions {
  doc: Y.Doc;
  awareness: Awareness;
  phrases: string[];
  lastUserEdit: () => number;
}

/** Drives the simulated co-author. Returns a stop function. */
function startPeerSimulation({ doc, awareness, phrases, lastUserEdit }: PeerOptions): () => void {
  const fragment = doc.getXmlFragment("content");

  let paragraph: Y.XmlElement | null = [...fragment.toArray()].reverse().find(isParagraph) ?? null;
  let text: Y.XmlText | null = null;
  let start: Y.RelativePosition | null = null; // first char of the phrase being typed
  let typed = 0;
  let phraseIdx = 0;
  let phase: "resting" | "typing" | "holding" | "erasing" = "resting";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const alive = (type: Y.AbstractType<unknown>): boolean => {
    let cur: Y.AbstractType<unknown> = type;
    while (cur._item) {
      if (cur._item.deleted) return false;
      cur = cur._item.parent as Y.AbstractType<unknown>;
    }
    return cur === (fragment as unknown as Y.AbstractType<unknown>);
  };

  /** The text node at the end of the peer's paragraph; relocates if it was removed. */
  const ensureTarget = (): Y.XmlText => {
    if (!paragraph || !alive(paragraph as unknown as Y.AbstractType<unknown>)) {
      paragraph = [...fragment.toArray()].reverse().find(isParagraph) ?? null;
    }
    doc.transact(() => {
      if (!paragraph) {
        paragraph = new Y.XmlElement("paragraph");
        fragment.push([paragraph]);
      }
      const last = paragraph.length > 0 ? paragraph.get(paragraph.length - 1) : null;
      if (last instanceof Y.XmlText) {
        text = last;
      } else {
        text = new Y.XmlText();
        paragraph.push([text]);
      }
    }, PEER_ORIGIN);
    return text!;
  };

  const textAlive = () => !!text && alive(text as unknown as Y.AbstractType<unknown>);

  const caretIndex = (): number | null => {
    if (!text || !textAlive()) return null;
    if (start && typed > 0) {
      const abs = Y.createAbsolutePositionFromRelativePosition(start, doc);
      if (!abs || abs.type !== (text as unknown as Y.AbstractType<unknown>)) return null;
      return abs.index + typed;
    }
    return text.length;
  };

  /**
   * Uses assoc = 0 (default) so the relative position stays attached after
   * characters inserted at `index` and retreats when characters before it are
   * deleted — all within the single ySyncPlugin transaction.
   */
  const publishCursor = (index: number | null) => {
    if (!text || index === null || !textAlive()) {
      awareness.setLocalStateField("cursor", null);
      return;
    }
    const rel = Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(text, index));
    const cur = awareness.getLocalState()?.cursor;
    if (
      cur &&
      Y.compareRelativePositions(
        Y.createRelativePositionFromJSON(cur.head),
        Y.createRelativePositionFromJSON(rel)
      )
    ) {
      return;
    }
    awareness.setLocalStateField("cursor", { anchor: rel, head: rel });
  };

  const schedule = (ms: number) => {
    if (!stopped) timer = setTimeout(tick, ms);
  };

  const finishPhrase = () => {
    typed = 0;
    start = null;
    phraseIdx = (phraseIdx + 1) % phrases.length;
    phase = "resting";
    publishCursor(caretIndex());
    schedule(1800);
  };

  const typingDelay = (ch: string) =>
    55 + Math.random() * 75 + (/[\s,.?!]/.test(ch) ? 90 + Math.random() * 120 : 0);

  function tick() {
    if (stopped) return;

    // Politely wait while the visitor is typing.
    if (Date.now() - lastUserEdit() < USER_IDLE_MS) {
      publishCursor(caretIndex());
      schedule(400);
      return;
    }

    const phrase = phrases[phraseIdx];

    switch (phase) {
      case "resting": {
        const target = ensureTarget();
        typed = 0;
        start = null;
        publishCursor(target.length);
        phase = "typing";
        schedule(700);
        return;
      }

      case "typing": {
        const index = typed === 0 ? (textAlive() ? text!.length : null) : caretIndex();
        if (index === null) {
          finishPhrase();
          return;
        }
        publishCursor(index);
        doc.transact(() => text!.insert(index, phrase[typed]), PEER_ORIGIN);
        if (typed === 0) start = Y.createRelativePositionFromTypeIndex(text!, index, -1);
        typed++;
        if (typed >= phrase.length) {
          phase = "holding";
          schedule(2200);
        } else {
          schedule(typingDelay(phrase[typed - 1]));
        }
        return;
      }

      case "holding": {
        phase = "erasing";
        schedule(0);
        return;
      }

      case "erasing": {
        const index = caretIndex();
        // Only erase her own characters: stop if the visitor changed the phrase.
        if (index === null || typed === 0 || plainText(text!)[index - 1] !== phrase[typed - 1]) {
          finishPhrase();
          return;
        }
        doc.transact(() => text!.delete(index - 1, 1), PEER_ORIGIN);
        typed--;
        if (typed === 0) finishPhrase();
        else schedule(28 + Math.random() * 30);
        return;
      }
    }
  }

  // Show her caret right away, start typing a bit later.
  publishCursor(ensureTarget().length);
  schedule(1500);

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    awareness.setLocalState(null);
  };
}

function useIsSmallScreen(): boolean {
  const query = "(max-width: 639px)";
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return matches;
}

export default function LiveEditorDemo() {
  const { t, language } = useLanguage();
  const isSmall = useIsSmallScreen();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<CollaborationConfig | null>(null);

  // Prevent y-prosemirror's tr.scrollIntoView() on remote peer updates from
  // yanking the scroll container or the page window while Natasha types.
  const extraPlugins = useMemo(() => {
    let suppressScroll = false;
    return [
      new Plugin({
        state: {
          init: () => null,
          apply(tr) {
            const yMeta = tr.getMeta(ySyncPluginKey);
            suppressScroll = Boolean(yMeta && yMeta.isChangeOrigin);
            return null;
          },
        },
        props: {
          handleScrollToSelection() {
            if (suppressScroll) {
              suppressScroll = false;
              return true;
            }
            return false;
          },
        },
      }),
    ];
  }, []);

  useEffect(() => {
    // Visitor's document and the simulated co-author's document, synced in memory.
    const userDoc = new Y.Doc();
    const peerDoc = new Y.Doc();
    const fragment = userDoc.getXmlFragment("content");
    seedYFragmentFromMarkdown(buildInitialMarkdown(t), fragment);
    Y.applyUpdate(peerDoc, Y.encodeStateAsUpdate(userDoc), userDoc);

    let lastUserEdit = 0;
    const onUserUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === peerDoc) return;
      lastUserEdit = Date.now();
      Y.applyUpdate(peerDoc, update, userDoc);
    };
    const onPeerUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === userDoc) return;
      const scrollEl = wrapperRef.current?.firstElementChild as HTMLElement | null;
      const prevTop = scrollEl ? scrollEl.scrollTop : 0;
      const prevWinY = window.scrollY;
      Y.applyUpdate(userDoc, update, peerDoc);
      if (scrollEl && scrollEl.scrollTop !== prevTop) {
        scrollEl.scrollTop = prevTop;
      }
      if (window.scrollY !== prevWinY) {
        window.scrollTo(window.scrollX, prevWinY);
      }
    };
    userDoc.on("update", onUserUpdate);
    peerDoc.on("update", onPeerUpdate);

    const userAwareness = new Awareness(userDoc);
    const peerAwareness = new Awareness(peerDoc);
    const onPeerAwareness = (
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }
    ) => {
      const changed = added.concat(updated, removed);
      applyAwarenessUpdate(userAwareness, encodeAwarenessUpdate(peerAwareness, changed), PEER_ORIGIN);
    };
    peerAwareness.on("update", onPeerAwareness);
    peerAwareness.setLocalStateField("user", { name: t("landing.demoPeerName"), color: PEER_COLOR });

    const stopPeer = startPeerSimulation({
      doc: peerDoc,
      awareness: peerAwareness,
      phrases: [t("landing.demoPhrase1"), t("landing.demoPhrase2"), t("landing.demoPhrase3")],
      lastUserEdit: () => lastUserEdit,
    });

    setConfig({ yXmlFragment: fragment, awareness: userAwareness, destroy: () => {} });

    return () => {
      stopPeer();
      peerAwareness.off("update", onPeerAwareness);
      userDoc.off("update", onUserUpdate);
      peerDoc.off("update", onPeerUpdate);
      setConfig(null);
      // Let the editor view unmount before tearing the documents down.
      setTimeout(() => {
        peerAwareness.destroy();
        userAwareness.destroy();
        peerDoc.destroy();
        userDoc.destroy();
      }, 0);
    };
    // Rebuild the session (with translated content) only when the language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  return (
    <div ref={wrapperRef} className="tc-live-demo h-[260px] sm:h-[420px] flex flex-col">
      <style>{DEMO_STYLES}</style>
      {config && (
        <EditorCore
          key={language}
          content=""
          editorMode="seamless"
          onChange={() => {}}
          collaboration={config}
          extraPlugins={extraPlugins}
          textZoom={isSmall ? 76 : 95}
        />
      )}
    </div>
  );
}
