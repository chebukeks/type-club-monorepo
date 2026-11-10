import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Globe, RefreshCw, Menu, X, Cloud, Lightbulb, ChevronLeft } from "lucide-react";
import { EditorMode } from "./MarkdownEditor";
import RawModeWarningModal, { STORAGE_KEY_HIDE_RAW_WARNING } from "./RawModeWarningModal";
import { useLanguage } from "../context/LanguageContext";

interface EditorHeaderProps {
  title: string;
  setTitle: (v: string) => void;
  editorMode: EditorMode;
  setEditorMode: (m: EditorMode) => void;
  onPublish: () => void;
  isNew: boolean;
  articleId?: number | null;
  slug?: string;
  authorNickname?: string;
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
  articleId,
  slug,
  authorNickname,
  collabActive,
  collabSynced,
  userRole,
  suggestionModeActive,
  onToggleSuggestionMode,
}: EditorHeaderProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showRawWarning, setShowRawWarning] = useState(false);

  useEffect(() => {
    const handleTyping = () => {
      setMenuOpen(false);
    };
    window.addEventListener('editor-typing', handleTyping);
    return () => window.removeEventListener('editor-typing', handleTyping);
  }, []);

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
          <span>{t('titlebar.advisorBadge')}</span>
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
        title={suggestionModeActive ? t('titlebar.turnOffSuggestion') : t('titlebar.turnOnSuggestion')}
      >
        <Lightbulb size={14} className={`shrink-0 ${suggestionModeActive ? "text-amber-500" : "text-gray-400"}`} />
        <span>{t('titlebar.advisorBadge')}</span>
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
          title={collabSynced ? t('editor.syncedDesc') : t('editor.connecting')}
        >
          {collabSynced ? <Cloud size={14} /> : <RefreshCw size={14} className="animate-spin" />}
          <span className="hidden sm:inline">{collabSynced ? t('editor.synced') : t('editor.syncing')}</span>
        </div>
      )}

      {isAuthor && (
        <button
          onClick={onPublish}
          className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors shrink-0 flex items-center gap-1 font-medium shadow-sm"
        >
          <Globe size={14} />
          <span className="hidden sm:inline">{t('editor.publish')}</span>
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile: floating toggle button when header is collapsed */}
      <button
        type="button"
        className={`sm:hidden fixed top-2 right-3 z-30 p-1.5 rounded-lg bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-md border border-gray-200/80 dark:border-gray-800/80 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-90 transition-all duration-250 ease-out flex items-center justify-center cursor-pointer ${
          menuOpen
            ? "opacity-0 scale-75 rotate-90 pointer-events-none"
            : "opacity-100 scale-100 rotate-0 pointer-events-auto"
        }`}
        onClick={() => setMenuOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile: backdrop overlay when header is expanded */}
      <div
        className={`sm:hidden fixed inset-0 z-40 bg-black/25 dark:bg-black/50 backdrop-blur-[2px] transition-opacity duration-250 ease-out ${
          menuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMenuOpen(false)}
      />

      <header
        className={`bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-b border-gray-200/90 dark:border-gray-800/90
          fixed top-0 inset-x-0 z-50 rounded-b-2xl shadow-2xl
          transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          sm:relative sm:top-auto sm:inset-x-auto sm:z-auto sm:shrink-0 sm:rounded-none sm:shadow-none sm:translate-y-0 sm:opacity-100 sm:pointer-events-auto sm:transition-none sm:bg-white dark:sm:bg-gray-950
          ${
            menuOpen
              ? "translate-y-0 opacity-100 pointer-events-auto"
              : "-translate-y-full opacity-0 pointer-events-none sm:translate-y-0 sm:opacity-100 sm:pointer-events-auto"
          }`}
      >
        {/* Main row */}
        <div className="flex items-center px-3 sm:px-4 gap-2 sm:gap-3 h-12 sm:h-14">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                if (articleId && authorNickname && slug) {
                  navigate(`/${authorNickname}/${slug}`);
                } else {
                  navigate(-1);
                }
              }}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              title={t('common.back')}
            >
              <ChevronLeft size={20} />
            </button>
            <Link to="/" className="shrink-0 hover:opacity-80 flex items-center" title="Type Club">
              <img src="/icons/icon_48x48.png" alt="Type Club" className="h-7 w-7 sm:h-8 sm:w-8" />
            </Link>
          </div>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('common.untitled')}
            className="flex-1 bg-transparent text-sm sm:text-lg font-semibold outline-none placeholder-gray-300 dark:placeholder-gray-600 min-w-0"
          />

          {/* Desktop: buttons inline */}
          <div className="hidden sm:flex items-center gap-2 sm:gap-3">
            <SuggestionBadge />
            <ModeSwitcher />
            <ActionButtons />
          </div>

          {/* Mobile: close button when expanded */}
          <button
            type="button"
            className="sm:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 active:scale-90 transition-all duration-150 shrink-0 cursor-pointer"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X
              size={20}
              className={`transition-transform duration-300 ease-out ${
                menuOpen ? "rotate-0 scale-100" : "-rotate-90 scale-75"
              }`}
            />
          </button>
        </div>

        {/* Mobile: expandable menu - seamless without horizontal dividing border */}
        <div className="sm:hidden px-3 pb-2.5 pt-0.5 space-y-1.5">
          {/* Mode Switcher - full width segmented control */}
          {!isSuggestionActive && (
            <div>
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 w-full">
                {modes.map((m) => (
                  <button
                    key={m.mode}
                    onClick={() => {
                      handleModeChange(m.mode);
                      setMenuOpen(false);
                    }}
                    className={`flex-1 py-1 text-[11px] font-medium rounded transition-all text-center ${
                      editorMode === m.mode
                        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-xs"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Row 2: Advisor, Synced, Publish all in ONE compact row */}
          <div className="flex items-center gap-1.5 w-full">
            {/* Advisor Toggle / Badge */}
            {editorMode === "seamless" && (
              userRole === "editor" ? (
                <div
                  className="flex-1 min-w-0 h-7.5 px-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[11px] font-medium border border-amber-200 dark:border-amber-800 flex items-center justify-center gap-1.5 shrink-0 cursor-default"
                  title={t('titlebar.advisorBadgeTitle')}
                >
                  <Lightbulb size={13} className="shrink-0 text-amber-500" />
                  <span className="truncate">{t('titlebar.advisorBadge')}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onToggleSuggestionMode?.(!suggestionModeActive)}
                  className={`flex-1 min-w-0 h-7.5 px-2 rounded-lg text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 ${
                    suggestionModeActive
                      ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shadow-xs"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 border border-transparent"
                  }`}
                  title={suggestionModeActive ? t('titlebar.turnOffSuggestion') : t('titlebar.turnOnSuggestion')}
                >
                  <Lightbulb size={13} className={`shrink-0 ${suggestionModeActive ? "text-amber-500" : "text-gray-400"}`} />
                  <span className="truncate">{t('titlebar.advisorBadge')}</span>
                </button>
              )
            )}

            {/* Synced Status */}
            {collabActive && (
              <div
                className={`flex-1 min-w-0 h-7.5 px-2 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-medium border ${
                  collabSynced
                    ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/50"
                    : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50"
                }`}
                title={collabSynced ? t('editor.syncedDesc') : t('editor.connecting')}
              >
                {collabSynced ? <Cloud size={13} className="shrink-0" /> : <RefreshCw size={13} className="animate-spin shrink-0" />}
                <span className="truncate">{collabSynced ? t('editor.synced') : t('editor.syncing')}</span>
              </div>
            )}

            {/* Publish Button */}
            {isAuthor && (
              <button
                type="button"
                onClick={() => {
                  onPublish();
                  setMenuOpen(false);
                }}
                className="flex-1 min-w-0 h-7.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-[11px] flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                title={t('editor.publish')}
              >
                <Globe size={13} className="shrink-0" />
                <span className="truncate">{t('editor.publish')}</span>
              </button>
            )}
          </div>
        </div>

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
    </>
  );
}
