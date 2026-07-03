import { useEffect, useRef, useState, useMemo } from "react";
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
import { toggleMark } from "prosemirror-commands";

import { parseMarkdown, serializeMarkdown } from "../editor/markdownConfig";
import { getKeymapPlugins } from "../editor/keymap";
import { getInputRulesPlugin } from "../editor/inputRules";
import { seamlessPlugin } from "../editor/seamlessPlugin";
import { syntaxHighlightPlugin } from "../editor/syntaxHighlightPlugin";
import { CodeBlockView } from "../editor/codeBlockView";
import { linkTooltipPlugin } from "../editor/linkTooltipPlugin";
import { mathActivePlugin } from "../editor/mathActivePlugin";
import { MathBlockView } from "../editor/mathBlockView";
import { getEditorStyles } from "../editor/editorTheme";
import { tocPlugin } from "../editor/tocPlugin";
import { foldingPlugin } from "../editor/foldingPlugin";
import { HeadingView } from "../editor/headingView";
import { MathInlineView } from "../editor/mathInlineView";
import { ImageView } from "../editor/imageView";
import { interactivePlugin } from "../editor/interactivePlugin";
import { focusModePlugin } from "../editor/focusModePlugin";
import { typographyPlugin } from "../editor/typographyPlugin";
import { schema } from "../editor/schema";

export type EditorMode = "raw" | "seamless" | "preview";

let styleInjected = false;
function injectStyles() {
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

interface MarkdownEditorProps {
  content: string;
  editorMode: EditorMode;
  onChange: (content: string) => void;
  textZoom?: number;
  documentZoom?: number;
  readOnly?: boolean;
}

export function MarkdownEditor({
  content,
  editorMode,
  onChange,
  textZoom = 100,
  documentZoom = 100,
  readOnly = false,
}: MarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastEmittedRef = useRef(content);

  const docScale = documentZoom / 100;

  useEffect(() => {
    injectStyles();
    if (!editorRef.current) return;
    if (editorMode === "raw") return;

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

    const syncPlugin = new Plugin({
      view() {
        return {
          update(view, prevState) {
            if (!view.state.doc.eq(prevState.doc)) {
              const md = serializeMarkdown(view.state.doc);
              lastEmittedRef.current = md;
              onChangeRef.current(md);
            }
          },
        };
      },
    });

    const plugins: Plugin[] = isPreview
      ? [history(), dropCursor(), gapCursor(), syncPlugin, foldingPlugin, interactivePlugin, syntaxHighlightPlugin, typographyPlugin()]
      : [
          ...getKeymapPlugins(),
          getInputRulesPlugin(),
          columnResizing({}),
          tableEditing(),
          tabPlugin,
          seamlessPlugin,
          syntaxHighlightPlugin,
          linkTooltipPlugin(),
          mathActivePlugin,
          history(),
          dropCursor(),
          syncPlugin,
          foldingPlugin,
          interactivePlugin,
          typographyPlugin(),
        ];

    const editorState = EditorState.create({ doc, plugins });

    const view = new EditorView(editorRef.current, {
      state: editorState,
      editable: () => !isPreview,
      nodeViews: {
        heading: (node, view, getPos) => new HeadingView(node, view, getPos),
        code_block: (node, view, getPos) => new CodeBlockView(node, view, getPos),
        math_block: (node, view, getPos) => new MathBlockView(node, view, getPos),
        image: (node, view, getPos) => new ImageView(node, view, getPos),
        math_inline: isPreview
          ? (node: PMNode) => new MathInlinePreviewView(node)
          : (node, view, getPos) => new MathInlineView(node, view, getPos),
      },
    });

    if (isPreview) {
      view.dom.classList.add("preview-mode");
    }

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [editorMode, readOnly]);

  // Update content from props (external change only — skip editor's own emissions)
  useEffect(() => {
    if (!viewRef.current || editorMode === "raw") return;
    if (content === lastEmittedRef.current) return;
    const newDoc = parseMarkdown(content);
    if (!viewRef.current.state.doc.eq(newDoc)) {
      lastEmittedRef.current = content;
      viewRef.current.dispatch(
        viewRef.current.state.tr.replaceWith(0, viewRef.current.state.doc.content.size, newDoc.content)
      );
    }
  }, [content, editorMode]);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (editorMode !== "seamless" || !viewRef.current) return;
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  const applyFormat = (markName: string) => {
    const view = viewRef.current;
    if (!view) return;
    const mark = (schema.marks as Record<string, unknown>)[markName];
    if (mark) {
      toggleMark(mark as import("prosemirror-model").MarkType)(view.state, view.dispatch);
      view.focus();
    }
    setCtxMenu(null);
  };

  const formatItems = [
    { label: "Bold", hotkey: "Ctrl+B", command: "strong" },
    { label: "Italic", hotkey: "Ctrl+I", command: "em" },
    { label: "Code", hotkey: "Ctrl+E", command: "code" },
    { label: "Strikethrough", hotkey: "Ctrl+Shift+X", command: "s" },
    { label: "Highlight", hotkey: "Ctrl+Shift+H", command: "highlight" },
  ];

  if (editorMode === "raw") {
    return (
      <div className="flex-1 overflow-auto bg-[var(--bg-base)]">
        <textarea
          ref={textareaRef}
          className="w-full h-full resize-none outline-none bg-transparent text-[var(--editor-text)] p-6"
          style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            fontSize: `${14 * (textZoom / 100)}px`,
            lineHeight: "1.6",
            maxWidth: "860px",
            margin: "0 auto",
            display: "block",
            tabSize: 2,
          }}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          readOnly={readOnly}
        />
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-auto bg-[var(--bg-base)]"
      style={{
        "--editor-font-size": `${15 * (textZoom / 100) * docScale}px`,
        "--doc-scale": docScale,
      } as React.CSSProperties}
      onContextMenu={handleContextMenu}
      onClick={() => setCtxMenu(null)}
    >
      <div ref={editorRef} className="h-full w-full" />

      {ctxMenu && (
        <div
          className="fixed bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1 flex flex-col text-sm"
          style={{ top: ctxMenu.y, left: ctxMenu.x, minWidth: "220px" }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {formatItems.map((item) => (
            <button
              key={item.command}
              className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-left"
              onClick={() => applyFormat(item.command)}
            >
              <span>{item.label}</span>
              <span className="text-xs text-gray-400">{item.hotkey}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
