import { useState } from "react";
import { Globe, RefreshCw, Menu, X, Cloud, Lightbulb } from "lucide-react";
import { EditorMode } from "./MarkdownEditor";
import RawModeWarningModal, { STORAGE_KEY_HIDE_RAW_WARNING } from "./RawModeWarningModal";

interface EditorHeaderProps {
  title: string;
  setTitle: (v: string) => void;
  editorMode: EditorMode;
  setEditorMode: (m: EditorMode) => void;
  onPublish: () => void;
  isNew: boolean;
  onToggleHeader: () => void;
  collabActive?: boolean;
  collabSynced?: boolean;
  userRole?: string | null;
  suggestionModeActive?: boolean;
  onToggleSuggestionMode?: (v: boolean) => void;
}

export default function EditorHeader({
  title,
  setTitle,
  editorMode,
  setEditorMode,
  onPublish,
  isNew,
  onToggleHeader,
  collabActive,
  collabSynced,
  userRole,
  suggestionModeActive,
  onToggleSuggestionMode,
}: EditorHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showRawWarning, setShowRawWarning] = useState(false);

  const isAuthor = userRole === "author" || isNew || !userRole;
  const isSuggestionActive = userRole === "editor" || (suggestionModeActive ?? false);

  const modes: { mode: EditorMode; label: string }[] = [
    { mode: "seamless", label: "Seamless" },
    { mode: "raw", label: "Raw" },
    { mode: "preview", label: "Preview" },
  ];

  const handleModeChange = (mode: EditorMode) => {
    if (mode === "raw" && collabActive && localStorage.getItem(STORAGE_KEY_HIDE_RAW_WARNING) !== "true") {
      setShowRawWarning(true);
      return;
    }
    setEditorMode(mode);
  };

  const ModeSwitcher = ({ className }: { className?: string }) => {
    if (isSuggestionActive) return null;
    return (
      <div className={`flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 ${className || ""}`}>
        {modes.map((m) => (
          <button
            key={m.mode}
            onClick={() => handleModeChange(m.mode)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              editorMode === m.mode
                ? "bg-white dark:bg-gray-700 shadow-sm"
                : "hover:bg-white/50 dark:hover:bg-gray-700/50"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    );
  };

  const SuggestionBadge = () => {
    if (editorMode !== "seamless") return null;

    if (userRole === "editor") {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-xs font-medium border border-amber-200 dark:border-amber-800 shadow-sm cursor-default">
          <Lightbulb size={14} className="shrink-0 text-amber-500" />
          <span>Режим советчика</span>
        </div>
      );
    }

    return (
      <button
        onClick={() => onToggleSuggestionMode?.(!suggestionModeActive)}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
          suggestionModeActive
            ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shadow-sm"
            : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 border border-transparent"
        }`}
        title={suggestionModeActive ? "Выключить режим советчика" : "Включить режим советчика"}
      >
        <Lightbulb size={14} className={`shrink-0 ${suggestionModeActive ? "text-amber-500" : "text-gray-400"}`} />
        <span>Режим советчика</span>
      </button>
    );
  };

  const ActionButtons = ({ className }: { className?: string }) => (
    <div className={`flex items-center gap-1.5 ${className || ""}`}>
      {collabActive && (
        <div
          className={`text-xs px-3 py-1.5 rounded-md shrink-0 flex items-center gap-1 ${
            collabSynced
              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
              : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
          }`}
          title={collabSynced ? "Changes are saved automatically" : "Connecting to collaboration server…"}
        >
          {collabSynced ? <Cloud size={14} /> : <RefreshCw size={14} className="animate-spin" />}
          <span className="hidden sm:inline">{collabSynced ? "Synced" : "Syncing…"}</span>
        </div>
      )}

      {isAuthor && (
        <button
          onClick={onPublish}
          className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors shrink-0 flex items-center gap-1 font-medium shadow-sm"
        >
          <Globe size={14} />
          <span className="hidden sm:inline">Publish</span>
        </button>
      )}
    </div>
  );

  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shrink-0">
      {/* Main row */}
      <div className="flex items-center px-3 sm:px-4 gap-2 sm:gap-3 h-14">
        <button onClick={onToggleHeader} className="shrink-0 hover:opacity-80" title="Toggle header">
          <img src="/icons/icon_48x48.png" alt="Type Club" className="h-8 w-8" />
        </button>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
          className="flex-1 bg-transparent text-base sm:text-lg font-semibold outline-none placeholder-gray-300 dark:placeholder-gray-600 min-w-0"
        />

        {/* Desktop: buttons inline */}
        <div className="hidden sm:flex items-center gap-2 sm:gap-3">
          <SuggestionBadge />
          <ModeSwitcher />
          <ActionButtons />
        </div>

        {/* Mobile: menu toggle */}
        <button
          className="sm:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile: expandable menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-gray-200 dark:border-gray-800 px-3 py-2 space-y-2 bg-white dark:bg-gray-950">
          <div className="flex items-center gap-2">
            <SuggestionBadge />
            <ModeSwitcher />
          </div>
          <ActionButtons />
        </div>
      )}

      {showRawWarning && (
        <RawModeWarningModal
          onConfirm={() => {
            setShowRawWarning(false);
            setEditorMode("raw");
          }}
          onCancel={() => setShowRawWarning(false)}
        />
      )}
    </header>
  );
}
