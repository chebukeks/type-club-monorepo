import { useState } from "react";
import { Save, Globe, RefreshCw, Menu, X } from "lucide-react";
import { EditorMode } from "./MarkdownEditor";

interface EditorHeaderProps {
  title: string;
  setTitle: (v: string) => void;
  editorMode: EditorMode;
  setEditorMode: (m: EditorMode) => void;
  autosave: boolean;
  setAutosave: (v: boolean) => void;
  onSave: () => void;
  onPublish: () => void;
  saving: boolean;
  isNew: boolean;
  onToggleHeader: () => void;
}

export default function EditorHeader({
  title,
  setTitle,
  editorMode,
  setEditorMode,
  autosave,
  setAutosave,
  onSave,
  onPublish,
  saving,
  isNew,
  onToggleHeader,
}: EditorHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const modes: { mode: EditorMode; label: string }[] = [
    { mode: "seamless", label: "Seamless" },
    { mode: "raw", label: "Raw" },
    { mode: "preview", label: "Preview" },
  ];

  const ModeSwitcher = ({ className }: { className?: string }) => (
    <div className={`flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 ${className || ""}`}>
      {modes.map((m) => (
        <button
          key={m.mode}
          onClick={() => setEditorMode(m.mode)}
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

  const ActionButtons = ({ className }: { className?: string }) => (
    <div className={`flex items-center gap-1.5 ${className || ""}`}>
      <button
        onClick={() => setAutosave(!autosave)}
        className={`text-xs px-2 py-1 rounded-md transition-colors shrink-0 ${
          autosave
            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
            : "bg-gray-100 dark:bg-gray-800 text-gray-500"
        }`}
        title="Toggle autosave"
      >
        <RefreshCw size={14} className="inline sm:mr-1" />
        <span className="hidden sm:inline">Auto</span>
      </button>

      <button
        onClick={onSave}
        disabled={saving}
        className="text-xs px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0 flex items-center gap-1 disabled:opacity-50"
      >
        <Save size={14} />
        <span className="hidden sm:inline">{saving ? "Saving..." : "Save"}</span>
      </button>

      <button
        onClick={onPublish}
        className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors shrink-0 flex items-center gap-1"
      >
        <Globe size={14} />
        <span className="hidden sm:inline">Publish</span>
      </button>
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

        {/* Desktop: all buttons inline */}
        <div className="hidden sm:flex items-center gap-2 sm:gap-3">
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
          <ModeSwitcher />
          <ActionButtons />
        </div>
      )}
    </header>
  );
}
