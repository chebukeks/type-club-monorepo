import { useEffect, useRef } from "react";
import "katex/dist/katex.min.css";
import katex from "katex";
import { EditorState, Plugin } from "prosemirror-state";
import { EditorView, NodeView } from "prosemirror-view";
import { Node as PMNode } from "prosemirror-model";
import { history } from "prosemirror-history";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { columnResizing, tableEditing, goToNextCell } from "prosemirror-tables";
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

import type { EditorProps } from "./types";

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
  const lastEmittedRef = useRef(content);
  const onTocUpdateRef = useRef(onTocUpdate);
  onTocUpdateRef.current = onTocUpdate;
  const focusModeRef = useRef(focusMode);
  focusModeRef.current = focusMode;

  const collaborationRef = useRef(collaboration);
  collaborationRef.current = collaboration;

  const docScale = documentZoom / 100;

  // ── Scroll position restoration ──
  useEffect(() => {
    if (scrollTop == null) return;
    const timer = setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollTop;
      }
    }, 30);
    return () => clearTimeout(timer);
  }, [scrollTop, editorMode]);

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
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

    const doc = parseMarkdown(content);
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

    const syncPlugin = new Plugin({
      view() {
        return {
          update(view, prevState) {
            if (isUnmounted) return;
            if (!view.state.doc.eq(prevState.doc)) {
              const md = serializeMarkdown(view.state.doc);
              lastEmittedRef.current = md;
              onChangeRef.current(md);
            }
          },
        };
      },
    });

    const historyPlugins = collaboration ? [] : [history()];

    const plugins: Plugin[] = isPreview
      ? [...historyPlugins, dropCursor(), gapCursor(), syncPlugin, foldingPlugin, interactivePlugin, syntaxHighlightPlugin, typographyPlugin(), focusModePlugin(() => focusModeRef.current || 'none'), tocPlugin((toc, sug) => onTocUpdateRef.current?.(toc, sug)), ...collabPlugins, ...(extraPlugins || [])]
      : [
          ...suggestionPlugins,
          ...getKeymapPlugins(),
          getInputRulesPlugin(),
          columnResizing({}),
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
      view.dispatch = () => {};
      view.destroy();
      viewRef.current = null;
    };
  }, [editorMode, readOnly, collaboration, userRole, userId, userNickname, suggestionModeActive]);

  useEffect(() => {
    if (!viewRef.current || editorMode === "raw" || collaboration) return;
    if (content === lastEmittedRef.current) return;
    const newDoc = parseMarkdown(content);
    if (!viewRef.current.state.doc.eq(newDoc)) {
      lastEmittedRef.current = content;
      viewRef.current.dispatch(
        viewRef.current.state.tr.replaceWith(0, viewRef.current.state.doc.content.size, newDoc.content)
      );
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
      lastEmittedRef.current = md;
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
