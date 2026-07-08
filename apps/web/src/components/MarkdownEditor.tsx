import { useState, useRef, useMemo } from "react";
import { toggleMark } from "prosemirror-commands";
import { TextSelection, NodeSelection } from "prosemirror-state";
import { deleteTable } from "prosemirror-tables";
import type { EditorView } from "prosemirror-view";

import { EditorCore, schema, tableEditPluginKey } from "@type-club/editor";
import type { EditorMode } from "@type-club/editor";

import { useCollaboration } from "../hooks/useCollaboration";

export type { EditorMode } from "@type-club/editor";

const LANGUAGES = [
  { label: "Без языка", value: "" },
  { label: "JavaScript", value: "javascript" },
  { label: "TypeScript", value: "typescript" },
  { label: "Python", value: "python" },
  { label: "Bash", value: "bash" },
  { label: "HTML", value: "html" },
  { label: "CSS", value: "css" },
  { label: "JSON", value: "json" },
  { label: "SQL", value: "sql" },
  { label: "Rust", value: "rust" },
  { label: "Go", value: "go" },
  { label: "Java", value: "java" },
  { label: "C++", value: "cpp" },
  { label: "C", value: "c" },
  { label: "Ruby", value: "ruby" },
  { label: "PHP", value: "php" },
  { label: "YAML", value: "yaml" },
  { label: "XML", value: "xml" },
  { label: "Diff", value: "diff" },
  { label: "Markdown", value: "markdown" },
  { label: "Dockerfile", value: "dockerfile" },
  { label: "GraphQL", value: "graphql" },
];

interface MarkdownEditorProps {
  content: string;
  editorMode: EditorMode;
  onChange: (content: string) => void;
  textZoom?: number;
  documentZoom?: number;
  readOnly?: boolean;
  articleId?: number | null;
}

export function MarkdownEditor({
  content,
  editorMode,
  onChange,
  textZoom,
  documentZoom,
  readOnly,
  articleId,
}: MarkdownEditorProps) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [ctxSubmenu, setCtxSubmenu] = useState<"table" | "code" | null>(null);
  const [ctxTable, setCtxTable] = useState<number | null>(null);
  const [tableCols, setTableCols] = useState(3);
  const [tableRows, setTableRows] = useState(3);
  const [codeLang, setCodeLang] = useState("");
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const viewRef = useRef<EditorView | null>(null);
  const collab = useCollaboration(articleId ?? null);

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
      } catch { /* ignore */ }
    }

    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  const handleTableCopy = () => {
    const view = viewRef.current;
    if (!view || ctxTable == null) return;
    const tr = view.state.tr.setSelection(NodeSelection.create(view.state.doc, ctxTable));
    view.dispatch(tr);
    view.dom.focus();
    document.execCommand("copy");
    closeCtxMenu();
  };

  const handleTableCut = () => {
    const view = viewRef.current;
    if (!view || ctxTable == null) return;
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
    if (!view || ctxTable == null) return;
    view.dispatch(view.state.tr.setMeta(tableEditPluginKey, ctxTable));
    view.focus();
    closeCtxMenu();
  };

  const handleTableDelete = () => {
    const view = viewRef.current;
    if (!view || ctxTable == null) return;
    deleteTable(view.state, view.dispatch);
    view.focus();
    closeCtxMenu();
  };

  const applyFormat = (markName: string) => {
    const view = viewRef.current;
    if (!view) return;
    const mark = (schema.marks as Record<string, unknown>)[markName];
    if (mark) {
      toggleMark(mark as import("prosemirror-model").MarkType)(view.state, view.dispatch);
      view.focus();
    }
    closeCtxMenu();
  };

  const handleClipboard = (action: "copy" | "cut" | "paste") => {
    const view = viewRef.current;
    if (!view) return;
    view.dom.focus();
    document.execCommand(action);
    closeCtxMenu();
  };

  const insertBlockNode = (blockNode: import("prosemirror-model").Node) => {
    const view = viewRef.current;
    if (!view) return;
    const { $head } = view.state.selection;

    let blockDepth = -1;
    for (let d = $head.depth; d >= 0; d--) {
      const name = $head.node(d).type.name;
      if (name === "paragraph" || name === "heading" || name === "code_block" || name === "math_block") {
        blockDepth = d;
        break;
      }
    }
    if (blockDepth === -1) return;

    const blockStart = $head.before(blockDepth);
    const blockEnd = $head.after(blockDepth);
    const blockNodeAt = view.state.doc.nodeAt($head.before(blockDepth));
    const isEmpty = !blockNodeAt || blockNodeAt.textContent.trim() === "";

    if (isEmpty) {
      const tr = view.state.tr.replaceWith(blockStart, blockEnd, blockNode);
      tr.setSelection(TextSelection.near(tr.doc.resolve(blockStart + 1)));
      view.dispatch(tr);
    } else {
      const tr = view.state.tr.insert(blockEnd, blockNode);
      tr.setSelection(TextSelection.near(tr.doc.resolve(blockEnd + 1)));
      view.dispatch(tr);
    }

    view.focus();
    closeCtxMenu();
  };

  const insertTable = () => {
    const headerCells = Array.from({ length: tableCols }, () =>
      schema.nodes.table_header.create(null, schema.nodes.paragraph.create())
    );
    const bodyRows = Array.from({ length: tableRows - 1 }, () =>
      schema.nodes.table_row.create(
        null,
        Array.from({ length: tableCols }, () =>
          schema.nodes.table_cell.create(null, schema.nodes.paragraph.create())
        )
      )
    );
    const table = schema.nodes.table.create(null, [
      schema.nodes.table_row.create(null, headerCells),
      ...bodyRows,
    ]);
    insertBlockNode(table);
  };

  const insertCodeBlock = (lang?: string) => {
    const language = lang !== undefined ? lang : codeLang;
    const codeBlock = schema.nodes.code_block.create({ params: language || "" });
    insertBlockNode(codeBlock);
  };

  const insertMathBlock = () => {
    const mathBlock = schema.nodes.math_block.create();
    insertBlockNode(mathBlock);
  };

  const formatItems = [
    { label: "Жирный", hotkey: "Ctrl+B", command: "strong" },
    { label: "Курсив", hotkey: "Ctrl+I", command: "em" },
    { label: "Код", hotkey: "Ctrl+E", command: "code" },
    { label: "Зачёркнутый", hotkey: "Ctrl+Shift+X", command: "s" },
    { label: "Выделение", hotkey: "Ctrl+Shift+H", command: "highlight" },
    { label: "Спойлер", hotkey: "Ctrl+Shift+S", command: "spoiler" },
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
            {r === 0 ? `Заголовок ${c + 1}` : `Ячейка ${c + 1}`}
          </td>
        );
      }
      rows.push(<tr key={r}>{cells}</tr>);
    }
    return rows;
  }, [tableCols, tableRows]);

  return (
    <div
      className="flex-1 overflow-auto bg-[var(--bg-base)]"
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
        onEditorView={(v) => { viewRef.current = v; }}
        collaboration={collab.config ?? undefined}
      />

      {ctxMenu && ctxTable !== null && (
        <div
          className="fixed bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1 flex flex-col text-sm"
          style={ctxMenuStyle!}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
        >
          <button className={btnClass} onClick={handleTableCopy}>
            <span>Копировать таблицу</span>
          </button>
          <button className={btnClass} onClick={handleTableCut}>
            <span>Вырезать таблицу</span>
          </button>
          <button className={btnClass} onClick={handleTableEdit}>
            <span>Редактировать таблицу</span>
          </button>
          <button className={btnClass} onClick={handleTableDelete}>
            <span>Удалить таблицу</span>
          </button>
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
            <span>Копировать</span>
            <span className="text-xs text-gray-400">Ctrl+C</span>
          </button>
          <button className={btnClass} onClick={() => handleClipboard("cut")}>
            <span>Вырезать</span>
            <span className="text-xs text-gray-400">Ctrl+X</span>
          </button>
          <button className={btnClass} onClick={() => handleClipboard("paste")}>
            <span>Вставить</span>
            <span className="text-xs text-gray-400">Ctrl+V</span>
          </button>
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
            <span>Создать таблицу...</span>
            <span className="text-xs text-gray-400">▸</span>
          </button>
          <button className={btnClass} onClick={() => setCtxSubmenu("code")}>
            <span>Создать блок кода...</span>
            <span className="text-xs text-gray-400">▸</span>
          </button>
          <button className={btnClass} onClick={insertMathBlock}>
            <span>Создать блок математики</span>
          </button>
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
            <span>← Назад</span>
          </button>
          <div className={sepClass} />
          {numInput("Столбцы", tableCols, setTableCols)}
          {numInput("Строки", tableRows, setTableRows)}
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
            >Создать</button>
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
            <span>← Назад</span>
          </button>
          <div className={sepClass} />
          <div className="px-5 py-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Язык</span>
            <div className="relative mt-1.5">
              <input
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-gray-400"
                placeholder="Без языка"
                value={codeLang}
                onChange={(e) => setCodeLang(e.target.value)}
                onFocus={() => setShowLangDropdown(true)}
                onBlur={() => setTimeout(() => setShowLangDropdown(false), 200)}
              />
              {showLangDropdown && (
                <div className="absolute left-0 right-0 top-full mt-0.5 max-h-40 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-[60]">
                  {LANGUAGES.filter(l => !codeLang || l.label.toLowerCase().includes(codeLang.toLowerCase()) || l.value.includes(codeLang)).map((l) => (
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
            >Создать</button>
            {codeLang && (
              <button
                className="flex-1 py-1.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={() => insertCodeBlock("")}
              >Без языка</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
