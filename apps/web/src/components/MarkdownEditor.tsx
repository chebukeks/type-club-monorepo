import { useState, useRef, useMemo, useEffect } from "react";
import { MessageCircleMore } from "lucide-react";
import { toggleMark } from "prosemirror-commands";
import { TextSelection, NodeSelection, Selection } from "prosemirror-state";
import { deleteTable } from "prosemirror-tables";
import type { EditorView } from "prosemirror-view";

import { EditorCore, schema, tableEditPluginKey } from "@type-club/editor";
import type { EditorMode, CollaborationConfig, TocItem, SuggestionItem } from "@type-club/editor";
import { useLanguage } from "../context/LanguageContext";
import AddNoteModal from "./AddNoteModal";

export type { EditorMode } from "@type-club/editor";

const CODE_LANGUAGES = [
  "javascript", "typescript", "python", "bash", "html", "css", "json", "mermaid", "sql",
  "rust", "go", "java", "cpp", "c", "ruby", "php", "yaml", "xml", "diff",
  "markdown", "dockerfile", "graphql"
];

interface MarkdownEditorProps {
  content: string;
  editorMode: EditorMode;
  onChange: (content: string) => void;
  textZoom?: number;
  documentZoom?: number;
  readOnly?: boolean;
  collaboration?: CollaborationConfig;
  userRole?: "author" | "co_author" | "editor" | null;
  userId?: number;
  userNickname?: string;
  suggestionModeActive?: boolean;
  onTocUpdate?: (toc: TocItem[], suggestions?: SuggestionItem[]) => void;
}

export function MarkdownEditor({
  content,
  editorMode,
  onChange,
  textZoom = 100,
  documentZoom = 100,
  readOnly = false,
  collaboration,
  userRole,
  userId,
  userNickname,
  suggestionModeActive,
  onTocUpdate,
}: MarkdownEditorProps) {
  const { t } = useLanguage();
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [ctxSubmenu, setCtxSubmenu] = useState<"table" | "code" | null>(null);
  const [ctxTable, setCtxTable] = useState<number | null>(null);
  const [tableCols, setTableCols] = useState(3);
  const [tableRows, setTableRows] = useState(3);
  const [codeLang, setCodeLang] = useState("");
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [codeLangPicker, setCodeLangPicker] = useState<{
    pos: number;
    currentLang: string;
    rect: { top: number; left: number; bottom: number; right: number };
  } | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  const isSuggestionActive = userRole === "editor" || (suggestionModeActive ?? false);

  useEffect(() => {
    const handleCodeBlockLang = (e: Event) => {
      if (readOnly || editorMode !== "seamless" || isSuggestionActive) return;
      const { pos, currentLang, rect } = (e as CustomEvent).detail;
      setCodeLangPicker({ pos, currentLang, rect });
    };
    window.addEventListener("editor-change-code-block-lang", handleCodeBlockLang);
    return () => window.removeEventListener("editor-change-code-block-lang", handleCodeBlockLang);
  }, [readOnly, editorMode, isSuggestionActive]);

  const handleSelectCodeLang = (newLang: string) => {
    if (viewRef.current && codeLangPicker) {
      const tr = viewRef.current.state.tr;
      const node = viewRef.current.state.doc.nodeAt(codeLangPicker.pos);
      if (node && (node.type.name === "code_block" || node.type.name === "fence")) {
        tr.setNodeMarkup(codeLangPicker.pos, null, {
          ...node.attrs,
          params: newLang === "plaintext" ? "" : newLang,
        });
        viewRef.current.dispatch(tr);
        viewRef.current.focus();
      }
    }
    setCodeLangPicker(null);
  };

  useEffect(() => {
    const handleOpenModal = () => setShowAddNoteModal(true);
    window.addEventListener("editor-open-add-note-modal", handleOpenModal);
    return () => window.removeEventListener("editor-open-add-note-modal", handleOpenModal);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const { pos } = (e as CustomEvent<{ pos: number }>).detail;
      if (!viewRef.current || viewRef.current.isDestroyed) return;
      try {
        let domNode: Node | null = null;
        try { domNode = viewRef.current.nodeDOM(pos); } catch {}
        if (!domNode) {
          try { domNode = viewRef.current.domAtPos(pos).node; } catch {}
        }
        const el = domNode instanceof Element ? domNode : domNode?.parentElement;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } catch (err) {
        console.error("Scroll to TOC position failed:", err);
      }
    };
    window.addEventListener("editor-scroll-to", handler);
    return () => window.removeEventListener("editor-scroll-to", handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const { pos } = (e as CustomEvent<{ pos: number; toPos: number; item: SuggestionItem }>).detail;
      if (!viewRef.current || viewRef.current.isDestroyed) return;
      try {
        const view = viewRef.current;
        if (!readOnly) view.focus();

        const maxPos = view.state.doc.content.size;
        const validPos = Math.min(Math.max(0, pos), maxPos);

        const $pos = view.state.doc.resolve(validPos);
        let sel: Selection;
        if ($pos.nodeAfter && $pos.nodeAfter.isInline) {
          sel = TextSelection.create(view.state.doc, validPos);
        } else if ($pos.nodeAfter && !$pos.nodeAfter.isInline) {
          sel = NodeSelection.create(view.state.doc, validPos);
        } else {
          sel = TextSelection.create(view.state.doc, validPos);
        }
        if (!readOnly) {
          view.dispatch(view.state.tr.setSelection(sel).scrollIntoView());
        }

        let domNode: Node | null = null;
        try { domNode = view.nodeDOM(validPos); } catch {}
        if (!domNode) {
          try { domNode = view.domAtPos(validPos).node; } catch {}
        }
        const el = domNode instanceof Element ? domNode : domNode?.parentElement;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } catch (err) {
        console.error("Scroll to suggestion failed:", err);
      }
    };
    window.addEventListener("editor-scroll-to-suggestion", handler);
    return () => window.removeEventListener("editor-scroll-to-suggestion", handler);
  }, [readOnly]);

  const handleAddNoteSubmit = (noteText: string) => {
    const view = viewRef.current;
    if (!view || !noteText.trim()) return;
    const { from } = view.state.selection;
    const noteNode = view.state.schema.nodes.suggestion_note.create({
      noteId: crypto.randomUUID(),
      sugAuthorId: userId ?? 0,
      sugAuthorName: userNickname || t('editor.advisor'),
      sugColor: "#f59e0b",
      noteText: noteText.trim(),
      sugCreatedAt: new Date().toISOString(),
    });
    const tr = view.state.tr.insert(from, noteNode);
    tr.setMeta("suggestionAction", true);
    view.dispatch(tr);
    view.focus();
  };

  const closeCtxMenu = () => {
    setCtxMenu(null);
    setCtxSubmenu(null);
    setCtxTable(null);
  };

  const ctxMenuStyle = useMemo((): React.CSSProperties | null => {
    if (!ctxMenu) return null;
    const menuHeight = ctxSubmenu === "table" ? 300 : ctxSubmenu === "code" ? 260 : ctxTable !== null ? 180 : 400;
    const vh = window.innerHeight;
    const fitsBelow = ctxMenu.y + menuHeight <= vh - 10;
    return {
      top: fitsBelow ? ctxMenu.y : undefined,
      bottom: fitsBelow ? undefined : vh - ctxMenu.y,
      left: Math.min(ctxMenu.x, window.innerWidth - 270),
      minWidth: ctxSubmenu === "table" ? "260px" : ctxSubmenu === "code" ? "250px" : "230px",
    };
  }, [ctxMenu, ctxSubmenu, ctxTable]);

  const handleContextMenu = (e: React.MouseEvent) => {
    const view = viewRef.current;
    if (editorMode !== "seamless") return;
    e.preventDefault();
    setCtxTable(null);
    setCtxSubmenu(null);
    setTableCols(3);
    setTableRows(3);
    setCodeLang("");

    if (view) {
      try {
        const clickPos = view.posAtDOM(e.target as Node, 0);
        const $click = view.state.doc.resolve(clickPos);
        for (let d = $click.depth; d > 0; d--) {
          if ($click.node(d).type.name === "table") {
            setCtxTable($click.before(d));
            setCtxMenu({ x: e.clientX, y: e.clientY });
            return;
          }
        }
      } catch {
        // click outside editor content
      }
    }

    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  const handleTableCopy = () => {
    const view = viewRef.current;
    if (!view || ctxTable === null) return;
    const tr = view.state.tr.setSelection(NodeSelection.create(view.state.doc, ctxTable));
    view.dispatch(tr);
    view.dom.focus();
    document.execCommand("copy");
    closeCtxMenu();
  };

  const handleTableCut = () => {
    const view = viewRef.current;
    if (!view || ctxTable === null) return;
    const tr = view.state.tr.setSelection(NodeSelection.create(view.state.doc, ctxTable));
    view.dispatch(tr);
    view.dom.focus();
    document.execCommand("copy");
    deleteTable(view.state, view.dispatch);
    view.focus();
    closeCtxMenu();
  };

  const handleTableEdit = () => {
    const view = viewRef.current;
    if (!view || ctxTable === null) return;
    view.dispatch(view.state.tr.setMeta(tableEditPluginKey, ctxTable));
    view.focus();
    closeCtxMenu();
  };

  const handleTableDelete = () => {
    const view = viewRef.current;
    if (!view || ctxTable === null) return;
    const { state, dispatch } = view;
    const tr = state.tr.setSelection(NodeSelection.create(state.doc, ctxTable));
    dispatch(tr);
    deleteTable(view.state, dispatch);
    closeCtxMenu();
  };

  const handleClipboard = async (action: "copy" | "cut" | "paste") => {
    const view = viewRef.current;
    closeCtxMenu();
    if (!view) return;
    view.focus();
    if (action === "copy") {
      document.execCommand("copy");
    } else if (action === "cut") {
      document.execCommand("cut");
    } else if (action === "paste") {
      document.execCommand("paste");
    }
  };

  const applyFormat = (command: string) => {
    const view = viewRef.current;
    closeCtxMenu();
    if (!view) return;
    view.focus();
    const markType = (schema.marks as any)[command];
    if (markType) {
      toggleMark(markType)(view.state, view.dispatch);
    }
  };

  const insertBlockNode = (node: any) => {
    const view = viewRef.current;
    closeCtxMenu();
    if (!view) return;
    view.focus();
    const { state, dispatch } = view;
    const { $from } = state.selection;

    let targetDepth = $from.depth;
    while (targetDepth > 1 && $from.node(targetDepth).type.name !== "table") {
      targetDepth--;
    }
    const targetNode = $from.node(targetDepth);
    const isEmptyParagraph =
      targetNode.type.name === "paragraph" && targetNode.content.size === 0;

    let tr = state.tr;
    if (isEmptyParagraph && targetDepth > 0) {
      const pos = $from.before(targetDepth);
      tr = tr.replaceWith(pos, pos + targetNode.nodeSize, node);
    } else {
      const insertPos = $from.after(Math.min(targetDepth, $from.depth));
      tr = tr.insert(insertPos, node);
    }
    dispatch(tr.scrollIntoView());
  };

  const insertTable = () => {
    const rowsNode = [];
    for (let r = 0; r < tableRows; r++) {
      const cellsNode = [];
      for (let c = 0; c < tableCols; c++) {
        const isHeader = r === 0;
        const cellType = isHeader ? schema.nodes.table_header : schema.nodes.table_cell;
        const text = isHeader ? t('editor.table.header', { col: c + 1 }) : t('editor.table.cell', { col: c + 1 });
        cellsNode.push(cellType.createAndFill({}, schema.nodes.paragraph.create({}, schema.text(text)))!);
      }
      rowsNode.push(schema.nodes.table_row.create({}, cellsNode));
    }
    const table = schema.nodes.table.create({}, rowsNode);
    insertBlockNode(table);
  };

  const insertCodeBlock = (lang = codeLang) => {
    const codeBlock = schema.nodes.code_block.create({ params: lang }, schema.text(" "));
    insertBlockNode(codeBlock);
  };

  const insertMathBlock = () => {
    const mathBlock = schema.nodes.math_block.create({}, schema.text("E = mc^2"));
    insertBlockNode(mathBlock);
  };

  const formatItems = [
    { label: t('editor.format.bold'), hotkey: "Ctrl+B", command: "strong" },
    { label: t('editor.format.italic'), hotkey: "Ctrl+I", command: "em" },
    { label: t('editor.format.code'), hotkey: "Ctrl+E", command: "code" },
    { label: t('editor.format.strikethrough'), hotkey: "Ctrl+Shift+X", command: "s" },
    { label: t('editor.format.highlight'), hotkey: "Ctrl+Shift+H", command: "highlight" },
    { label: t('editor.format.spoiler'), hotkey: "Ctrl+Shift+S", command: "spoiler" },
  ];

  const btnClass = "flex items-center justify-between w-full px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-left";
  const sepClass = "border-t border-gray-200 dark:border-gray-700 my-1";

  const numInput = (label: string, value: number, setValue: (v: number) => void, min = 1, max = 10) => (
    <div className="flex items-center gap-2 px-2 py-1">
      <span className="text-xs text-gray-500 dark:text-gray-400 w-16">{label}</span>
      <button
        className="w-6 h-6 flex items-center justify-center rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 text-sm"
        disabled={value <= min}
        onClick={() => setValue(value - 1)}
      >−</button>
      <span className="w-8 text-center text-sm text-gray-700 dark:text-gray-300">{value}</span>
      <button
        className="w-6 h-6 flex items-center justify-center rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 text-sm"
        disabled={value >= max}
        onClick={() => setValue(value + 1)}
      >+</button>
    </div>
  );

  const tablePreview = useMemo(() => {
    const rows: JSX.Element[] = [];
    for (let r = 0; r < tableRows; r++) {
      const cells: JSX.Element[] = [];
      for (let c = 0; c < tableCols; c++) {
        cells.push(
          <td key={c} className={`border border-gray-300 dark:border-gray-600 px-2 py-0.5 text-[11px] ${r === 0 ? "font-semibold bg-gray-100 dark:bg-gray-800" : ""}`}>
            {r === 0 ? t('editor.table.header', { col: c + 1 }) : t('editor.table.cell', { col: c + 1 })}
          </td>
        );
      }
      rows.push(<tr key={r}>{cells}</tr>);
    }
    return rows;
  }, [tableCols, tableRows, t]);

  const languagesList = useMemo(() => [
    { label: t('editor.noLanguage'), value: "" },
    ...CODE_LANGUAGES.map((lang) => ({
      label: lang.charAt(0).toUpperCase() + lang.slice(1),
      value: lang,
    }))
  ], [t]);

  return (
    <div
      className="flex-1 flex flex-col overflow-auto bg-[var(--bg-base)]"
      onContextMenu={handleContextMenu}
      onClick={() => closeCtxMenu()}
    >
      <EditorCore
        content={content}
        editorMode={editorMode}
        onChange={onChange}
        textZoom={textZoom}
        documentZoom={documentZoom}
        readOnly={readOnly}
        collaboration={collaboration}
        userRole={userRole}
        userId={userId}
        userNickname={userNickname}
        suggestionModeActive={suggestionModeActive}
        onTocUpdate={onTocUpdate}
        onEditorView={(v) => { viewRef.current = v; }}
      />

      {ctxMenu && ctxTable !== null && (
        <div
          className="fixed bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1 flex flex-col text-sm"
          style={ctxMenuStyle!}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
        >
          <button className={btnClass} onClick={handleTableCopy}>
            <span>{t('editor.table.copy')}</span>
          </button>
          {!isSuggestionActive && (
            <>
              <button className={btnClass} onClick={handleTableCut}>
                <span>{t('editor.table.cut')}</span>
              </button>
              <button className={btnClass} onClick={handleTableEdit}>
                <span>{t('editor.table.edit')}</span>
              </button>
              <button className={btnClass} onClick={handleTableDelete}>
                <span>{t('editor.table.delete')}</span>
              </button>
            </>
          )}
        </div>
      )}

      {ctxMenu && !ctxSubmenu && ctxTable === null && (
        <div
          className="fixed bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1 flex flex-col text-sm"
          style={ctxMenuStyle!}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
        >
          <button className={btnClass} onClick={() => handleClipboard("copy")}>
            <span>{t('editor.menu.copy')}</span>
            <span className="text-xs text-gray-400">Ctrl+C</span>
          </button>
          <button className={btnClass} onClick={() => handleClipboard("cut")}>
            <span>{t('editor.menu.cut')}</span>
            <span className="text-xs text-gray-400">Ctrl+X</span>
          </button>
          <button className={btnClass} onClick={() => handleClipboard("paste")}>
            <span>{t('editor.menu.paste')}</span>
            <span className="text-xs text-gray-400">Ctrl+V</span>
          </button>
          {!isSuggestionActive && (
            <>
              <div className={sepClass} />
              {formatItems.map((item) => (
                <button
                  key={item.command}
                  className={btnClass}
                  onClick={() => applyFormat(item.command)}
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-gray-400">{item.hotkey}</span>
                </button>
              ))}
              <div className={sepClass} />
              <button className={btnClass} onClick={() => setCtxSubmenu("table")}>
                <span>{t('editor.menu.createTable')}</span>
                <span className="text-xs text-gray-400">▸</span>
              </button>
              <button className={btnClass} onClick={() => setCtxSubmenu("code")}>
                <span>{t('editor.menu.createCodeBlock')}</span>
                <span className="text-xs text-gray-400">▸</span>
              </button>
              <button className={btnClass} onClick={insertMathBlock}>
                <span>{t('editor.menu.createMathBlock')}</span>
              </button>
            </>
          )}
          {(userRole === "editor" || isSuggestionActive) && (
            <>
              <div className={sepClass} />
              <button
                className={btnClass}
                onClick={() => {
                  closeCtxMenu();
                  setShowAddNoteModal(true);
                }}
              >
                <div className="flex items-center gap-1.5">
                  <MessageCircleMore size={14} className="text-amber-500 shrink-0" />
                  <span>{t('editor.menu.createNote')}</span>
                </div>
                <span className="text-xs text-gray-400">Ctrl+Q</span>
              </button>
            </>
          )}
        </div>
      )}

      {ctxMenu && ctxSubmenu === "table" && (
        <div
          className="fixed bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1 flex flex-col text-sm"
          style={ctxMenuStyle!}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
        >
          <button className={btnClass} onClick={() => setCtxSubmenu(null)}>
            <span>{t('common.back')}</span>
          </button>
          <div className={sepClass} />
          {numInput(t('editor.table.columns'), tableCols, setTableCols)}
          {numInput(t('editor.table.rows'), tableRows, setTableRows)}
          <div className={sepClass} />
          <div className="px-2 py-1 overflow-x-auto">
            <table className="w-full border-collapse">
              <tbody>{tablePreview}</tbody>
            </table>
          </div>
          <div className={sepClass} />
          <div className="px-3 py-1.5">
            <button
              className="w-full py-1.5 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              onClick={insertTable}
            >{t('common.create')}</button>
          </div>
        </div>
      )}

      {ctxMenu && ctxSubmenu === "code" && (
        <div
          className="fixed bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1 flex flex-col text-sm"
          style={ctxMenuStyle!}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
        >
          <button className={btnClass} onClick={() => setCtxSubmenu(null)}>
            <span>{t('common.back')}</span>
          </button>
          <div className={sepClass} />
          <div className="px-5 py-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">{t('editor.code.language')}</span>
            <div className="relative mt-1.5">
              <input
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-gray-400"
                placeholder={t('editor.noLanguage')}
                value={codeLang}
                onChange={(e) => setCodeLang(e.target.value)}
                onFocus={() => setShowLangDropdown(true)}
                onBlur={() => setTimeout(() => setShowLangDropdown(false), 200)}
              />
              {showLangDropdown && (
                <div className="absolute left-0 right-0 top-full mt-0.5 max-h-40 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-[60]">
                  {languagesList.filter(l => !codeLang || l.label.toLowerCase().includes(codeLang.toLowerCase()) || l.value.includes(codeLang)).map((l) => (
                    <div
                      key={l.value}
                      className={`px-3 py-1 text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${l.value === codeLang ? "text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-400"}`}
                      onMouseDown={() => { setCodeLang(l.value); setShowLangDropdown(false); }}
                    >{l.label}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className={sepClass} />
          <div className="px-3 py-1.5 flex gap-2">
            <button
              className="flex-1 py-1.5 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              onClick={() => insertCodeBlock()}
            >{t('common.create')}</button>
            {codeLang && (
              <button
                className="flex-1 py-1.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={() => insertCodeBlock("")}
              >{t('editor.noLanguage')}</button>
            )}
          </div>
        </div>
      )}

      {codeLangPicker && (
        <WebCodeBlockLangPopover
          currentLang={codeLangPicker.currentLang}
          rect={codeLangPicker.rect}
          onSelect={handleSelectCodeLang}
          onClose={() => setCodeLangPicker(null)}
          t={t}
        />
      )}

      <AddNoteModal
        isOpen={showAddNoteModal}
        onClose={() => setShowAddNoteModal(false)}
        onSubmit={handleAddNoteSubmit}
      />
    </div>
  );
}

function WebCodeBlockLangPopover({
  currentLang,
  rect,
  onSelect,
  onClose,
  t,
}: {
  currentLang: string;
  rect: { top: number; left: number; bottom: number; right: number };
  onSelect: (lang: string) => void;
  onClose: () => void;
  t: (key: any) => string;
}) {
  const [search, setSearch] = useState(currentLang || "");
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleScroll = (e: Event) => {
      if (popoverRef.current && popoverRef.current.contains(e.target as Node)) {
        return;
      }
      onClose();
    };
    window.addEventListener("mousedown", handleDown);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CODE_LANGUAGES;
    return CODE_LANGUAGES.filter((l) => l.toLowerCase().includes(q));
  }, [search]);

  const top = Math.min(window.innerHeight - 280, rect.bottom + 6);
  const left = Math.max(12, Math.min(window.innerWidth - 230, rect.left));

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl p-2 flex flex-col gap-1.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
      style={{ top, left, width: "210px" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">
        {t("editor.code.language")}
      </div>
      <input
        type="text"
        autoFocus
        value={search}
        placeholder={t("editor.noLanguage")}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSelect(search.trim());
          }
        }}
        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-800 dark:text-gray-200 outline-none focus:border-blue-500"
      />
      <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
        <button
          type="button"
          className={`text-left px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
            !search ? "font-semibold text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"
          }`}
          onClick={() => onSelect("")}
        >
          {t("editor.noLanguage")}
        </button>
        {filtered.map((lang) => (
          <button
            key={lang}
            type="button"
            className={`text-left px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
              lang === currentLang
                ? "font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40"
                : "text-gray-700 dark:text-gray-300"
            }`}
            onClick={() => onSelect(lang)}
          >
            {lang}
          </button>
        ))}
      </div>
      {search.trim() && !filtered.includes(search.trim().toLowerCase()) && (
        <button
          type="button"
          className="w-full mt-1 py-1 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
          onClick={() => onSelect(search.trim())}
        >
          {search.trim()}
        </button>
      )}
    </div>
  );
}
