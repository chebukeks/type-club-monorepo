import { useState, useRef } from "react";
import { toggleMark } from "prosemirror-commands";
import type { EditorView } from "prosemirror-view";

import { EditorCore, schema } from "@type-club/editor";
import type { EditorMode } from "@type-club/editor";

export type { EditorMode } from "@type-club/editor";

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
  textZoom,
  documentZoom,
  readOnly,
}: MarkdownEditorProps) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (editorMode !== "seamless") return;
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

  return (
    <div
      className="flex-1 overflow-auto bg-[var(--bg-base)]"
      onContextMenu={handleContextMenu}
      onClick={() => setCtxMenu(null)}
    >
      <EditorCore
        content={content}
        editorMode={editorMode}
        onChange={onChange}
        textZoom={textZoom}
        documentZoom={documentZoom}
        readOnly={readOnly}
        onEditorView={(v) => { viewRef.current = v; }}
      />

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
