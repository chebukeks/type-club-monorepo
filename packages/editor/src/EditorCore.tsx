import { useEffect, useRef } from "react";
import "katex/dist/katex.min.css";
import katex from "katex";
import { EditorState, Plugin, PluginKey } from "prosemirror-state";
import { EditorView, NodeView } from "prosemirror-view";
import { Node as PMNode } from "prosemirror-model";
import { history } from "prosemirror-history";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { tableEditing, goToNextCell, TableView } from "prosemirror-tables";
import { customColumnResizing } from "./editor/columnResizingPlugin";
import { keymap } from "prosemirror-keymap";
import { prosemirrorToYXmlFragment, yXmlFragmentToProsemirrorJSON } from "y-prosemirror";

import { parseMarkdown, serializeMarkdown } from "./editor/markdownConfig";
import { schema } from "./editor/schema";
import { getKeymapPlugins } from "./editor/keymap";
import { getInputRulesPlugin } from "./editor/inputRules";
import { seamlessPlugin } from "./editor/seamlessPlugin";
import { syntaxHighlightPlugin } from "./editor/syntaxHighlightPlugin";
import { CodeBlockView } from "./editor/codeBlockView";
import { linkTooltipPlugin } from "./editor/linkTooltipPlugin";
import { mathActivePlugin } from "./editor/mathActivePlugin";
import { MathBlockView } from "./editor/mathBlockView";
import { getEditorStyles } from "./editor/editorTheme";
import { foldingPlugin } from "./editor/foldingPlugin";
import { HeadingView } from "./editor/headingView";
import { MathInlineView } from "./editor/mathInlineView";
import { ImageView } from "./editor/imageView";
import { interactivePlugin } from "./editor/interactivePlugin";
import { typographyPlugin } from "./editor/typographyPlugin";
import { focusModePlugin } from "./editor/focusModePlugin";
import { tocPlugin } from "./editor/tocPlugin";
import { tableEditPlugin } from "./editor/tableEditPlugin";
import { pastePlugin } from "./editor/pastePlugin";
import { createCollaborationPlugins } from "./editor/collaborationPlugin";
import { createSuggestionPlugin } from "./editor/suggestionPlugin";
import { createSuggestionActionPlugin } from "./editor/suggestionActionPlugin";
import { SuggestionNoteView } from "./editor/suggestionNoteView";
import { spellcheckPlugin } from "./editor/spellcheckPlugin";
import { createMobileTypewriterPlugin } from "./editor/mobileTypewriterPlugin";

import {
  EXTERNAL_SYNC_META,
  createSyncTracker,
  resetSyncTracker,
  recordEmittedMarkdown,
  resolveExternalContentSync,
} from "./editor/contentSync";
import type { EditorProps } from "./types";

const syncPluginKey = new PluginKey<number>("editorCoreSync");

let styleInjected = false;

export function injectEditorStyles() {
  if (styleInjected) return;
  const style = document.createElement("style");
  style.id = "pm-editor-theme";
  style.textContent = getEditorStyles();
  document.head.appendChild(style);
  styleInjected = true;
}

class MathInlinePreviewView implements NodeView {
  dom: HTMLElement;
  node: PMNode;

  constructor(node: PMNode) {
    this.node = node;
    this.dom = document.createElement("span");
    this.dom.className = "math-inline-preview";
    this.dom.contentEditable = "false";
    this.renderMath();
  }

  renderMath() {
    const text = this.node.textContent?.trim() || "";
    this.dom.innerHTML = "";
    if (!text) {
      this.dom.innerHTML = '<span style="color: grey; opacity: 0.5;">Empty Math</span>';
      return;
    }
    try {
      katex.render(text, this.dom, { throwOnError: false, displayMode: false });
    } catch {
      this.dom.textContent = text;
    }
  }

  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.renderMath();
    return true;
  }

  stopEvent() { return true; }
  ignoreMutation() { return true; }
}

export function EditorCore({
  content,
  editorMode,
  onChange,
  textZoom = 100,
  documentZoom = 100,
  readOnly = false,
  onEditorView,
  className,
  focusMode,
  onTocUpdate,
  extraPlugins,
  containerStyle,
  collaboration,
  userRole,
  userId,
  userNickname,
  suggestionModeActive,
  scrollTop,
  onScroll,
}: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const contentRef = useRef(content);
  contentRef.current = content;
  const syncTrackerRef = useRef(createSyncTracker(content));
  const flushSyncRef = useRef<(() => void) | null>(null);
  const onTocUpdateRef = useRef(onTocUpdate);
  onTocUpdateRef.current = onTocUpdate;
  const focusModeRef = useRef(focusMode);
  focusModeRef.current = focusMode;

  const collaborationRef = useRef(collaboration);
  collaborationRef.current = collaboration;

  const docScale = documentZoom / 100;

  // ── Scroll position restoration ──
  const initialScrollRestoredRef = useRef(false);

  useEffect(() => {
    if (scrollTop == null || scrollTop <= 0) return;
    initialScrollRestoredRef.current = false;

    const restore = () => {
      if (initialScrollRestoredRef.current) return;
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollTop;
      }
    };

    restore();
    const id1 = requestAnimationFrame(restore);
    const id2 = setTimeout(restore, 50);
    const id3 = setTimeout(restore, 150);

    return () => {
      cancelAnimationFrame(id1);
      clearTimeout(id2);
      clearTimeout(id3);
    };
  }, [scrollTop, editorMode]);

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    initialScrollRestoredRef.current = true;
    onScroll?.(e.currentTarget.scrollTop);
  };

  useEffect(() => {
    injectEditorStyles();
    if (!editorRef.current) return;
    if (editorMode === "raw") return;

    let isUnmounted = false;

    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    let doc: PMNode;
    if (collaboration) {
      if (collaboration.yXmlFragment.length > 0) {
        try {
          const json = yXmlFragmentToProsemirrorJSON(collaboration.yXmlFragment);
          doc = schema.nodeFromJSON(json);
        } catch {
          doc = schema.topNodeType.createAndFill()!;
        }
      } else {
        doc = schema.topNodeType.createAndFill()!;
      }
    } else {
      doc = parseMarkdown(content);
      resetSyncTracker(syncTrackerRef.current, content);
    }
    const isPreview = editorMode === "preview" || readOnly;

    const tabPlugin = keymap({
      Tab: goToNextCell(1),
      "Shift-Tab": goToNextCell(-1),
    });

    const collabPlugins = collaboration
      ? createCollaborationPlugins(collaboration)
      : [];

    const isEditorRole = userRole === "editor";
    const isSuggestionActive = (isEditorRole || (suggestionModeActive ?? false)) && editorMode === "seamless";
    const suggestionPlugins: Plugin[] = [];

    if (!isPreview) {
      if (isSuggestionActive) {
        suggestionPlugins.push(
          createSuggestionPlugin({
            active: true,
            authorId: userId ?? 0,
            authorName: userNickname || (isEditorRole ? "Advisor" : "Author"),
            color: isEditorRole ? "#3b82f6" : "#10b981",
          })
        );
      }
      suggestionPlugins.push(createSuggestionActionPlugin({ userRole }));
    }

    const syncPlugin = new Plugin<number>({
      key: syncPluginKey,
      state: {
        init: () => 0,
        apply(tr, seq) {
          return tr.getMeta(EXTERNAL_SYNC_META) ? seq + 1 : seq;
        },
      },
      view(editorView) {
        let syncTimer: ReturnType<typeof setTimeout> | null = null;
        let lastDoc = doc;

        const flush = (currentDoc: PMNode) => {
          if (isUnmounted) return;
          const md = serializeMarkdown(currentDoc);
          recordEmittedMarkdown(syncTrackerRef.current, md, contentRef.current);
          onChangeRef.current(md);
        };

        const flushPending = () => {
          if (isUnmounted || editorView.isDestroyed) return;
          if (syncTimer) {
            clearTimeout(syncTimer);
            syncTimer = null;
            lastDoc = editorView.state.doc;
            flush(lastDoc);
          }
        };
        flushSyncRef.current = flushPending;

        return {
          update(view, prevState) {
            if (isUnmounted) return;
            const prevExternalSeq = syncPluginKey.getState(prevState) ?? 0;
            const nextExternalSeq = syncPluginKey.getState(view.state) ?? 0;
            if (nextExternalSeq !== prevExternalSeq) {
              if (syncTimer) {
                clearTimeout(syncTimer);
                syncTimer = null;
              }
              lastDoc = view.state.doc;
              return;
            }
            if (!view.state.doc.eq(prevState.doc)) {
              lastDoc = view.state.doc;
              if (syncTimer) clearTimeout(syncTimer);
              syncTimer = setTimeout(() => {
                flush(lastDoc);
                syncTimer = null;
              }, 200);
            }
          },
          destroy() {
            if (flushSyncRef.current === flushPending) {
              flushSyncRef.current = null;
            }
            if (syncTimer) {
              clearTimeout(syncTimer);
              syncTimer = null;
              if (!collaboration || lastDoc.content.size > 0) {
                flush(lastDoc);
              }
            }
          },
        };
      },
    });

    const historyPlugins = collaboration ? [] : [history()];

    const selectionTrackingPlugin = new Plugin({
      view() {
        return {
          update(v, prevState) {
            if (!v.state.selection.eq(prevState.selection)) {
              const { from, to, empty } = v.state.selection;
              const selectedText = empty ? '' : v.state.doc.textBetween(from, to, ' ');
              window.dispatchEvent(
                new CustomEvent('editor-selection-change', {
                  detail: { selectedText, empty },
                })
              );
            }
          },
        };
      },
    });

    const plugins: Plugin[] = isPreview
      ? [...historyPlugins, dropCursor(), gapCursor(), syncPlugin, foldingPlugin, interactivePlugin, syntaxHighlightPlugin, typographyPlugin(), focusModePlugin(() => focusModeRef.current || 'none'), tocPlugin((toc, sug) => onTocUpdateRef.current?.(toc, sug)), customColumnResizing({}), selectionTrackingPlugin, ...collabPlugins, ...(extraPlugins || [])]
      : [
          ...suggestionPlugins,
          ...getKeymapPlugins(),
          getInputRulesPlugin(),
          customColumnResizing({}),
          selectionTrackingPlugin,
          tableEditing(),
          pastePlugin(),
          tabPlugin,
          seamlessPlugin,
          syntaxHighlightPlugin,
          spellcheckPlugin,
          linkTooltipPlugin(),
          mathActivePlugin,
          ...historyPlugins,
          dropCursor(),
          syncPlugin,
          foldingPlugin,
          interactivePlugin,
          typographyPlugin(),
          tableEditPlugin(),
          focusModePlugin(() => focusModeRef.current || 'none'),
          tocPlugin((toc, sug) => onTocUpdateRef.current?.(toc, sug)),
          createMobileTypewriterPlugin(),
          ...collabPlugins,
          ...(extraPlugins || []),
        ];

    const editorState = EditorState.create({ doc, plugins });

    const view = new EditorView(editorRef.current, {
      state: editorState,
      editable: () => !isPreview,
      attributes: {
        spellcheck: 'false',
        autocorrect: 'off',
        autocapitalize: 'off',
      },
      nodeViews: {
        table: (node) => new TableView(node, 100),
        heading: (node, view, getPos) => new HeadingView(node, view, getPos),
        code_block: (node, view, getPos) => new CodeBlockView(node, view, getPos),
        math_block: (node, view, getPos) => new MathBlockView(node, view, getPos),
        image: (node, view, getPos) => new ImageView(node, view, getPos),
        suggestion_note: (node, view, getPos) => new SuggestionNoteView(node, view, getPos),
        math_inline: isPreview
          ? (node: PMNode) => new MathInlinePreviewView(node)
          : (node, view, getPos) => new MathInlineView(node, view, getPos),
      },
    });

    if (isPreview) {
      view.dom.classList.add("preview-mode");
    }

    viewRef.current = view;
    onEditorView?.(view);

    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('editor-mode-ready'))
    });

    return () => {
      isUnmounted = true;
      flushSyncRef.current = null;
      view.dispatch = () => {};
      view.destroy();
      viewRef.current = null;
    };
  }, [editorMode, readOnly, collaboration, userRole, userId, userNickname, suggestionModeActive]);

  useEffect(() => {
    const handleFlushSync = () => {
      flushSyncRef.current?.();
    };
    window.addEventListener("editor-flush-sync", handleFlushSync);
    return () => window.removeEventListener("editor-flush-sync", handleFlushSync);
  }, []);

  useEffect(() => {
    if (!viewRef.current || editorMode === "raw" || collaboration) return;
    const tr = resolveExternalContentSync({
      state: viewRef.current.state,
      incomingContent: content,
      tracker: syncTrackerRef.current,
      parseMarkdown,
      serializeMarkdown,
    });
    if (tr) {
      viewRef.current.dispatch(tr);
    }
  }, [content, editorMode, collaboration]);

  useEffect(() => {
    if (viewRef.current && !viewRef.current.isDestroyed) {
      viewRef.current.dispatch(viewRef.current.state.tr.setMeta('focusModeUpdate', true))
    }
  }, [focusMode]);

  useEffect(() => {
    if (editorMode === 'raw') {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('editor-mode-ready'))
      })
    }
  }, [editorMode]);

  // ── Raw-mode buffer for collaboration ──
  const rawBufferRef = useRef<string | null>(null);
  const prevModeRef = useRef(editorMode);

  useEffect(() => {
    const prevMode = prevModeRef.current;
    prevModeRef.current = editorMode;
    const collab = collaborationRef.current;

    // Entering raw mode while collaboration is active:
    // serialize the current Yjs document to markdown for the textarea.
    if (editorMode === 'raw' && collab) {
      const fragment = collab.yXmlFragment;
      const json = yXmlFragmentToProsemirrorJSON(fragment);
      const doc = schema.nodeFromJSON(json);
      const md = serializeMarkdown(doc);
      rawBufferRef.current = md;
      recordEmittedMarkdown(syncTrackerRef.current, md, contentRef.current);
      onChangeRef.current(md);
    }

    // Leaving raw mode back to seamless/preview while collaboration is active:
    // apply the buffered textarea edits back into the Yjs document.
    if (prevMode === 'raw' && editorMode !== 'raw' && collab && rawBufferRef.current !== null) {
      const fragment = collab.yXmlFragment;
      const ydoc = fragment.doc;
      if (ydoc) {
        ydoc.transact(() => {
          // Clear the existing Yjs fragment
          while (fragment.length > 0) {
            fragment.delete(0, 1);
          }
          // Parse the edited markdown and populate the fragment
          const newDoc = parseMarkdown(rawBufferRef.current!);
          prosemirrorToYXmlFragment(newDoc, fragment);
        });
      }
      rawBufferRef.current = null;
    }
  }, [editorMode]);

  if (editorMode === "raw") {
    return (
      <div className="flex-1 h-full flex flex-col overflow-auto bg-[var(--bg-base)] rounded-[inherit]" style={containerStyle}>
        <textarea
          ref={(el) => {
            (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
            scrollContainerRef.current = el;
          }}
          onScroll={handleScroll}
          onSelect={(e) => {
            const target = e.currentTarget;
            const text = target.value.slice(target.selectionStart, target.selectionEnd);
            window.dispatchEvent(
              new CustomEvent('editor-selection-change', {
                detail: { selectedText: text, empty: !text },
              })
            );
          }}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          className="w-full flex-1 resize-none outline-none bg-transparent text-[var(--editor-text)] p-6"
          style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            fontSize: `${14 * (textZoom / 100)}px`,
            lineHeight: "1.6",
            maxWidth: "860px",
            margin: "0 auto",
            display: "block",
            tabSize: 2,
          }}
          value={collaboration ? (rawBufferRef.current ?? content) : content}
          onChange={(e) => {
            if (collaboration) {
              rawBufferRef.current = e.target.value;
            }
            onChange(e.target.value);
          }}
          readOnly={readOnly}
        />
      </div>
    );
  }

    const focusClass = focusMode && focusMode !== 'none'
      ? focusMode === 'paragraph' ? 'focus-mode-paragraph'
        : focusMode === 'sentence' ? 'focus-mode-sentence'
        : 'focus-mode-lines'
      : '';

    return (
      <div
        ref={(el) => { scrollContainerRef.current = el; }}
        onScroll={handleScroll}
        className={`flex-1 overflow-auto bg-[var(--bg-base)] rounded-[inherit] ${className || ''} ${focusClass}`}
        style={{
          "--editor-font-size": `${15 * (textZoom / 100) * docScale}px`,
          "--doc-scale": docScale,
          ...containerStyle,
        } as React.CSSProperties}
      >
        <div ref={editorRef} className="h-full w-full" />
      </div>
    );
}
