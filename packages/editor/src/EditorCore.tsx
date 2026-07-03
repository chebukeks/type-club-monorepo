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

import { parseMarkdown, serializeMarkdown } from "./editor/markdownConfig";
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
import { schema } from "./editor/schema";

import type { EditorMode, EditorProps } from "./types";

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
}: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastEmittedRef = useRef(content);

  const docScale = documentZoom / 100;

  useEffect(() => {
    injectEditorStyles();
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
    >
      <div ref={editorRef} className="h-full w-full" />
    </div>
  );
}
