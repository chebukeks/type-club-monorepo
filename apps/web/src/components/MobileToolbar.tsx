import React, { useEffect, useState, useCallback, useRef } from "react";
import type { EditorView } from "prosemirror-view";
import { toggleMark, wrapIn } from "prosemirror-commands";
import { wrapInList } from "prosemirror-schema-list";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Highlighter,
  EyeOff,
  Heading,
  Pilcrow,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Table as TableIcon,
  Sigma,
  CornerDownRight,
  Indent,
  Outdent,
  Undo2,
  Redo2,
  FileCode,
  Plus,
  Camera,
  Image as ImageIcon,
  Clipboard,
  ChevronLeft,
} from "lucide-react";
import { TextSelection } from "prosemirror-state";
import {
  schema,
  universalExitCommand,
  undoCommand,
  redoCommand,
  indentListCommand,
  outdentListCommand,
  setHeadingLevel,
  isInList,
  isInTable,
  isInCodeBlock,
  isInExitableBlock,
  getActiveHeadingLevel,
  getListType,
  isInBlockquote,
  isMarkActive,
  canExit,
  isInMath,
} from "@type-club/editor";
import { useLanguage } from "../context/LanguageContext";

interface MobileToolbarProps {
  view: EditorView | null;
  onOpenTableSheet: () => void;
  onInsertTable: () => void;
  onInsertCodeBlock: () => void;
  onInsertMathBlock: () => void;
  onInsertImageFile: (fileOrUrl: File | string) => void;
}

type ActivePopup = "format" | "heading" | "list" | "insert" | null;

const MATH_BUTTONS: { label: string; snippet: string; cursorOffset?: number }[] = [
  { label: "\\", snippet: "\\" },
  { label: "{ }", snippet: "{}", cursorOffset: 1 },
  { label: "^", snippet: "^{}", cursorOffset: 2 },
  { label: "_", snippet: "_{}", cursorOffset: 2 },
  { label: "a/b", snippet: "\\frac{}{}", cursorOffset: 6 },
  { label: "√x", snippet: "\\sqrt{}", cursorOffset: 6 },
  { label: "( )", snippet: "()", cursorOffset: 1 },
  { label: "=", snippet: "=" },
  { label: "+", snippet: "+" },
  { label: "−", snippet: "-" },
  { label: "·", snippet: "\\cdot " },
  { label: "π", snippet: "\\pi " },
  { label: "±", snippet: "\\pm " },
  { label: "≤", snippet: "\\le " },
  { label: "≥", snippet: "\\ge " },
  { label: "∞", snippet: "\\infty " },
];

export default function MobileToolbar({
  view,
  onOpenTableSheet,
  onInsertTable,
  onInsertCodeBlock,
  onInsertMathBlock,
  onInsertImageFile,
}: MobileToolbarProps) {
  const { t } = useLanguage();
  const [bottomOffset, setBottomOffset] = useState(0);
  const [activePopup, setActivePopup] = useState<ActivePopup>(null);
  const [insertSubmenu, setInsertSubmenu] = useState<"image" | null>(null);
  const [, setTick] = useState(0);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Sync toolbar position with virtual keyboard via visualViewport
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleViewportChange = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setBottomOffset(offset);
    };

    vv.addEventListener("resize", handleViewportChange);
    vv.addEventListener("scroll", handleViewportChange);

    return () => {
      vv.removeEventListener("resize", handleViewportChange);
      vv.removeEventListener("scroll", handleViewportChange);
    };
  }, []);

  // Update button active states when selection or doc changes
  useEffect(() => {
    const handleSelectionChange = () => {
      setTick((t) => t + 1);
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  const runCommand = useCallback(
    (cmd: (state: any, dispatch: any, view: any) => boolean) => {
      if (!view) return;
      cmd(view.state, view.dispatch, view);
      view.focus();
    },
    [view]
  );

  const insertLatexSnippet = (snippet: string, cursorOffset?: number) => {
    if (!view) return;
    const { state, dispatch } = view;
    const { from, to } = state.selection;
    const selected = from !== to ? state.doc.textBetween(from, to) : "";

    let textToInsert = snippet;
    let newCursorPos = from + (cursorOffset !== undefined ? cursorOffset : snippet.length);

    if (selected) {
      if (snippet === "{}") {
        textToInsert = `{${selected}}`;
        newCursorPos = from + textToInsert.length;
      } else if (snippet === "()") {
        textToInsert = `(${selected})`;
        newCursorPos = from + textToInsert.length;
      } else if (snippet === "^{}") {
        textToInsert = `^{${selected}}`;
        newCursorPos = from + textToInsert.length;
      } else if (snippet === "_{}") {
        textToInsert = `_{${selected}}`;
        newCursorPos = from + textToInsert.length;
      } else if (snippet === "\\sqrt{}") {
        textToInsert = `\\sqrt{${selected}}`;
        newCursorPos = from + textToInsert.length;
      } else if (snippet === "\\frac{}{}") {
        textToInsert = `\\frac{${selected}}{}`;
        newCursorPos = from + textToInsert.length - 1;
      }
    }

    let tr = state.tr.insertText(textToInsert, from, to);
    tr = tr.setSelection(TextSelection.near(tr.doc.resolve(newCursorPos)));
    dispatch(tr.scrollIntoView());
    view.focus();
  };

  const handlePasteImageFromClipboard = async () => {
    setActivePopup(null);
    setInsertSubmenu(null);
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((type) => type.startsWith("image/"));
          if (imageType) {
            const blob = await item.getType(imageType);
            const ext = imageType.split("/")[1] || "png";
            const file = new File([blob], `clipboard-${Date.now()}.${ext}`, { type: imageType });
            onInsertImageFile(file);
            return;
          }
        }
      }

      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        const trimmed = text.trim();
        if (
          trimmed.startsWith("data:image/") ||
          /^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg|avif|bmp)(\?.*)?$/i.test(trimmed)
        ) {
          onInsertImageFile(trimmed);
          return;
        }
      }

      alert(t("toolbar.clipboardNoImage"));
    } catch (err) {
      console.warn("Clipboard read error:", err);
      alert(t("toolbar.clipboardError"));
    }
  };

  if (!view) return null;

  const state = view.state;

  // Context queries
  const inList = isInList(state);
  const inTable = isInTable(state);
  const inCode = isInCodeBlock(state);
  const inBlockquote = isInBlockquote(state);
  const inMath = isInMath(state);
  const exitAvailable = canExit(state);
  const activeHeadingLevel = getActiveHeadingLevel(state);
  const listType = getListType(state);

  // Mark queries
  const boldActive = isMarkActive(state, schema.marks.strong);
  const italicActive = isMarkActive(state, schema.marks.em);
  const strikeActive = isMarkActive(state, schema.marks.s);
  const codeActive = isMarkActive(state, schema.marks.code);
  const highlightActive = isMarkActive(state, schema.marks.highlight);
  const spoilerActive = isMarkActive(state, schema.marks.spoiler);
  const hasActiveMark =
    boldActive || italicActive || strikeActive || codeActive || highlightActive || spoilerActive;

  // Toggle checklist
  const handleToggleTaskList = () => {
    if (!view) return;
    if (inList) {
      const { $head } = view.state.selection;
      for (let d = $head.depth; d > 0; d--) {
        if ($head.node(d).type.name === "list_item") {
          const itemPos = $head.before(d);
          const currentChecked = $head.node(d).attrs.checked;
          const nextChecked = currentChecked === null ? false : null;
          view.dispatch(view.state.tr.setNodeMarkup(itemPos, null, { checked: nextChecked }));
          view.focus();
          return;
        }
      }
    } else {
      wrapInList(schema.nodes.bullet_list)(view.state, view.dispatch);
      const { $head } = view.state.selection;
      for (let d = $head.depth; d > 0; d--) {
        if ($head.node(d).type.name === "list_item") {
          view.dispatch(view.state.tr.setNodeMarkup($head.before(d), null, { checked: false }));
          break;
        }
      }
      view.focus();
    }
  };

  const btnBase =
    "flex items-center justify-center h-9 min-w-[34px] px-1.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors shrink-0 touch-manipulation select-none";
  const btnActive = "bg-blue-100 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400 font-bold";

  const popupBtnBase =
    "flex items-center justify-center h-10 min-w-[38px] px-2.5 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors shrink-0 touch-manipulation select-none";

  const sep = <div className="w-[1px] h-5 bg-gray-200 dark:bg-gray-800 mx-0.5 shrink-0" />;

  const togglePopup = (popup: ActivePopup) => {
    setActivePopup((prev) => {
      if (prev === popup) {
        setInsertSubmenu(null);
        return null;
      }
      setInsertSubmenu(null);
      return popup;
    });
  };

  return (
    <>
      {/* Hidden file inputs for Camera and Gallery */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="opacity-0 absolute -z-10 pointer-events-none w-0 h-0 overflow-hidden"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onInsertImageFile(file);
          }
          e.target.value = "";
          setActivePopup(null);
          setInsertSubmenu(null);
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="opacity-0 absolute -z-10 pointer-events-none w-0 h-0 overflow-hidden"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onInsertImageFile(file);
          }
          e.target.value = "";
          setActivePopup(null);
          setInsertSubmenu(null);
        }}
      />

      {/* Backdrop to dismiss upward flyouts on outside touch */}
      {!inMath && activePopup && (
        <div
          className="fixed inset-0 z-30"
          onPointerDown={(e) => {
            e.preventDefault();
            setActivePopup(null);
            setInsertSubmenu(null);
          }}
        />
      )}

      {/* Upward Flyout Menus */}
      {!inMath && activePopup && (
        <div
          className="md:hidden fixed left-2 right-2 z-40 flex justify-center pointer-events-none transition-all duration-75"
          style={{ bottom: `${bottomOffset + 48}px` }}
        >
          <div
            className="pointer-events-auto bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/90 dark:border-gray-800/90 shadow-2xl rounded-2xl p-1.5 flex items-center gap-1 max-w-full overflow-x-auto no-scrollbar animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-150 ease-out"
            onPointerDown={(e) => {
              // Keep focus inside editor
              e.preventDefault();
            }}
          >
            {/* Format Flyout */}
            {activePopup === "format" && (
              <>
                <button
                  type="button"
                  onClick={() => runCommand(toggleMark(schema.marks.strong))}
                  className={`${popupBtnBase} ${boldActive ? btnActive : ""}`}
                  title={t("toolbar.bold")}
                  aria-label={t("toolbar.bold")}
                >
                  <Bold size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => runCommand(toggleMark(schema.marks.em))}
                  className={`${popupBtnBase} ${italicActive ? btnActive : ""}`}
                  title={t("toolbar.italic")}
                  aria-label={t("toolbar.italic")}
                >
                  <Italic size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => runCommand(toggleMark(schema.marks.s))}
                  className={`${popupBtnBase} ${strikeActive ? btnActive : ""}`}
                  title={t("toolbar.strikethrough")}
                  aria-label={t("toolbar.strikethrough")}
                >
                  <Strikethrough size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => runCommand(toggleMark(schema.marks.code))}
                  className={`${popupBtnBase} ${codeActive ? btnActive : ""}`}
                  title={t("toolbar.code")}
                  aria-label={t("toolbar.code")}
                >
                  <Code size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => runCommand(toggleMark(schema.marks.highlight))}
                  className={`${popupBtnBase} ${highlightActive ? btnActive : ""}`}
                  title={t("toolbar.highlight")}
                  aria-label={t("toolbar.highlight")}
                >
                  <Highlighter size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => runCommand(toggleMark(schema.marks.spoiler))}
                  className={`${popupBtnBase} ${spoilerActive ? btnActive : ""}`}
                  title={t("toolbar.spoiler")}
                  aria-label={t("toolbar.spoiler")}
                >
                  <EyeOff size={18} />
                </button>
              </>
            )}

            {/* Heading Flyout */}
            {activePopup === "heading" && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    runCommand(setHeadingLevel(1));
                    setActivePopup(null);
                  }}
                  className={`${popupBtnBase} ${activeHeadingLevel === 1 ? btnActive : ""}`}
                  title={t("toolbar.heading1")}
                  aria-label={t("toolbar.heading1")}
                >
                  <span className="font-bold text-xs">H1</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    runCommand(setHeadingLevel(2));
                    setActivePopup(null);
                  }}
                  className={`${popupBtnBase} ${activeHeadingLevel === 2 ? btnActive : ""}`}
                  title={t("toolbar.heading2")}
                  aria-label={t("toolbar.heading2")}
                >
                  <span className="font-bold text-xs">H2</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    runCommand(setHeadingLevel(3));
                    setActivePopup(null);
                  }}
                  className={`${popupBtnBase} ${activeHeadingLevel === 3 ? btnActive : ""}`}
                  title={t("toolbar.heading3")}
                  aria-label={t("toolbar.heading3")}
                >
                  <span className="font-bold text-xs">H3</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    runCommand(setHeadingLevel(0));
                    setActivePopup(null);
                  }}
                  className={`${popupBtnBase} ${activeHeadingLevel === null ? btnActive : ""}`}
                  title={t("toolbar.paragraph")}
                  aria-label={t("toolbar.paragraph")}
                >
                  <Pilcrow size={18} />
                </button>
              </>
            )}

            {/* List Flyout */}
            {activePopup === "list" && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    runCommand(wrapInList(schema.nodes.bullet_list));
                    setActivePopup(null);
                  }}
                  className={`${popupBtnBase} ${listType === "bullet" ? btnActive : ""}`}
                  title={t("toolbar.bulletList")}
                  aria-label={t("toolbar.bulletList")}
                >
                  <List size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    runCommand(wrapInList(schema.nodes.ordered_list));
                    setActivePopup(null);
                  }}
                  className={`${popupBtnBase} ${listType === "ordered" ? btnActive : ""}`}
                  title={t("toolbar.orderedList")}
                  aria-label={t("toolbar.orderedList")}
                >
                  <ListOrdered size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleToggleTaskList();
                    setActivePopup(null);
                  }}
                  className={`${popupBtnBase} ${listType === "task" ? btnActive : ""}`}
                  title={t("toolbar.taskList")}
                  aria-label={t("toolbar.taskList")}
                >
                  <CheckSquare size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    runCommand(wrapIn(schema.nodes.blockquote));
                    setActivePopup(null);
                  }}
                  className={`${popupBtnBase} ${inBlockquote ? btnActive : ""}`}
                  title={t("toolbar.quote")}
                  aria-label={t("toolbar.quote")}
                >
                  <Quote size={18} />
                </button>
              </>
            )}

            {/* Insert Flyout */}
            {activePopup === "insert" && (
              <>
                {insertSubmenu === "image" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setInsertSubmenu(null)}
                      className={`${popupBtnBase} px-2`}
                      title={t("common.back")}
                      aria-label={t("common.back")}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        cameraInputRef.current?.click();
                      }}
                      className={`${popupBtnBase} flex items-center gap-1.5 px-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium`}
                      title={t("toolbar.takePhoto")}
                      aria-label={t("toolbar.takePhoto")}
                    >
                      <Camera size={17} />
                      <span className="text-xs font-semibold">{t("toolbar.takePhoto")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        galleryInputRef.current?.click();
                      }}
                      className={`${popupBtnBase} flex items-center gap-1.5 px-3`}
                      title={t("toolbar.choosePhoto")}
                      aria-label={t("toolbar.choosePhoto")}
                    >
                      <ImageIcon size={17} />
                      <span className="text-xs font-medium">{t("toolbar.choosePhoto")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePasteImageFromClipboard}
                      className={`${popupBtnBase} flex items-center gap-1.5 px-3`}
                      title={t("toolbar.fromClipboard")}
                      aria-label={t("toolbar.fromClipboard")}
                    >
                      <Clipboard size={17} />
                      <span className="text-xs font-medium">{t("toolbar.fromClipboard")}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setActivePopup(null);
                        if (inTable) {
                          onOpenTableSheet();
                        } else {
                          onInsertTable();
                        }
                      }}
                      className={`${popupBtnBase} flex items-center gap-1.5 px-3`}
                      title={t("toolbar.table")}
                      aria-label={t("toolbar.table")}
                    >
                      <TableIcon size={17} />
                      <span className="text-xs font-medium">{t("toolbar.table")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActivePopup(null);
                        onInsertCodeBlock();
                      }}
                      className={`${popupBtnBase} flex items-center gap-1.5 px-3`}
                      title={t("toolbar.codeBlock")}
                      aria-label={t("toolbar.codeBlock")}
                    >
                      <FileCode size={17} />
                      <span className="text-xs font-medium">{t("toolbar.codeBlock")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActivePopup(null);
                        onInsertMathBlock();
                      }}
                      className={`${popupBtnBase} flex items-center gap-1.5 px-3`}
                      title={t("toolbar.math")}
                      aria-label={t("toolbar.math")}
                    >
                      <Sigma size={17} />
                      <span className="text-xs font-medium">{t("toolbar.math")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInsertSubmenu("image")}
                      className={`${popupBtnBase} flex items-center gap-1.5 px-3`}
                      title={t("toolbar.image")}
                      aria-label={t("toolbar.image")}
                    >
                      <ImageIcon size={17} />
                      <span className="text-xs font-medium">{t("toolbar.image")}</span>
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Bottom Toolbar */}
      <div
        className="md:hidden fixed left-0 right-0 z-40 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 shadow-lg px-2 py-1 flex items-center transition-all duration-75"
        style={{ bottom: `${bottomOffset}px` }}
        onPointerDown={(e) => {
          // Prevent clicking toolbar from unfocusing editor
          e.preventDefault();
        }}
      >
        <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar w-full py-0.5">
          {/* History */}
          <button
            type="button"
            onClick={() => runCommand(undoCommand)}
            className={btnBase}
            title={t("toolbar.undo")}
            aria-label={t("toolbar.undo")}
          >
            <Undo2 size={17} />
          </button>
          <button
            type="button"
            onClick={() => runCommand(redoCommand)}
            className={btnBase}
            title={t("toolbar.redo")}
            aria-label={t("toolbar.redo")}
          >
            <Redo2 size={17} />
          </button>

          {sep}

          {inMath ? (
            <>
              {MATH_BUTTONS.map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => insertLatexSnippet(btn.snippet, btn.cursorOffset)}
                  className={`${btnBase} font-mono text-xs px-2 min-w-[32px]`}
                  title={btn.snippet}
                  aria-label={btn.label}
                >
                  {btn.label}
                </button>
              ))}
            </>
          ) : (
            <>
              {/* Group 1: Format (Aa) */}
              <button
                type="button"
                onClick={() => togglePopup("format")}
                className={`${btnBase} ${activePopup === "format" || hasActiveMark ? btnActive : ""}`}
                title={t("toolbar.format")}
                aria-label={t("toolbar.format")}
              >
                <span className="font-serif font-bold text-sm tracking-tight leading-none">Aa</span>
              </button>

              {/* Group 2: Headings (H / H1 / H2 / H3) */}
              <button
                type="button"
                onClick={() => togglePopup("heading")}
                className={`${btnBase} ${
                  activePopup === "heading" || activeHeadingLevel !== null ? btnActive : ""
                }`}
                title={t("toolbar.headings")}
                aria-label={t("toolbar.headings")}
              >
                {activeHeadingLevel ? (
                  <span className="font-bold text-xs">H{activeHeadingLevel}</span>
                ) : (
                  <Heading size={17} />
                )}
              </button>

              {/* Group 3: Lists & Quotes */}
              <button
                type="button"
                onClick={() => togglePopup("list")}
                className={`${btnBase} ${
                  activePopup === "list" || inList || inBlockquote ? btnActive : ""
                }`}
                title={t("toolbar.lists")}
                aria-label={t("toolbar.lists")}
              >
                <List size={17} />
              </button>

              {/* Group 4: Insert (+) */}
              <button
                type="button"
                onClick={() => togglePopup("insert")}
                className={`${btnBase} ${activePopup === "insert" ? btnActive : ""}`}
                title={t("toolbar.insert")}
                aria-label={t("toolbar.insert")}
              >
                <Plus size={18} />
              </button>
            </>
          )}

          {/* Contextual Buttons (ONLY rendered when context applies and not in math) */}
          {!inMath && (inList || inTable || exitAvailable) && sep}

          {/* List Indent / Outdent */}
          {!inMath && inList && (
            <>
              <button
                type="button"
                onClick={() => runCommand(outdentListCommand)}
                className={btnBase}
                title={t("toolbar.outdent")}
                aria-label={t("toolbar.outdent")}
              >
                <Outdent size={17} />
              </button>
              <button
                type="button"
                onClick={() => runCommand(indentListCommand)}
                className={btnBase}
                title={t("toolbar.indent")}
                aria-label={t("toolbar.indent")}
              >
                <Indent size={17} />
              </button>
            </>
          )}

          {/* Table Actions Sheet Trigger (Only inside Table) */}
          {!inMath && inTable && (
            <button
              type="button"
              onClick={onOpenTableSheet}
              className={`${btnBase} bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 font-medium`}
              title={t("toolbar.tableActions")}
              aria-label={t("toolbar.tableActions")}
            >
              <TableIcon size={17} />
              <span className="text-[10px] ml-0.5 font-bold">⋯</span>
            </button>
          )}

          {/* Universal Exit (Only inside exitable block, inline marks, or math) */}
          {exitAvailable && (
            <button
              type="button"
              onClick={() => runCommand(universalExitCommand)}
              className={`${btnBase} ${
                inTable || inCode || inMath
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 font-medium"
                  : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
              } px-2 ml-auto`}
              title={t("toolbar.exitTooltip")}
              aria-label={t("toolbar.exit")}
            >
              <CornerDownRight size={16} className="stroke-[2.5]" />
              <span className="text-[11px] font-medium ml-1 hidden min-[350px]:inline">
                {t("toolbar.exit")}
              </span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
