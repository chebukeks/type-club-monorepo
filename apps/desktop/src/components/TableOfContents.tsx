import { useState, useEffect } from "react";
import { List, X, BookOpen, MessageSquare, Plus, Minus, FileText } from "lucide-react";
import type { TocItem, SuggestionItem } from "@type-club/editor";
import type { TocLayoutMode } from "../types";
import { useEditor } from "../context/EditorContext";

interface TableOfContentsProps {
  toc: TocItem[];
  suggestions?: SuggestionItem[];
  tocLayoutMode?: TocLayoutMode;
  variant?: "floating" | "sidebar";
  showStats?: boolean;
  className?: string;
}

export default function TableOfContents({
  toc,
  suggestions = [],
  tocLayoutMode = "separate",
  variant = "floating",
  showStats = false,
  className = "",
}: TableOfContentsProps) {
  const { t, state } = useEditor();
  const [open, setOpen] = useState(false);
  const [activePos, setActivePos] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  const hasToc = tocLayoutMode === "combined" && toc && toc.length > 0;
  const showSuggestions = suggestions && suggestions.length > 0;

  useEffect(() => {
    if (open) {
      setMounted(true);
    } else {
      const timer = setTimeout(() => setMounted(false), 150);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (hasToc && activePos === null) {
      setActivePos(toc[0].pos);
    } else if (showSuggestions && activePos === null) {
      setActivePos(suggestions[0].pos);
    }
  }, [toc, suggestions, hasToc, showSuggestions, activePos]);

  if (!hasToc && !showSuggestions) return null;

  const handleSelectToc = (item: TocItem) => {
    setActivePos(item.pos);
    window.dispatchEvent(new CustomEvent("editor-scroll-to", { detail: { pos: item.pos } }));
  };

  const handleSelectSuggestion = (sug: SuggestionItem) => {
    setActivePos(sug.pos);
    window.dispatchEvent(
      new CustomEvent("editor-scroll-to-suggestion", {
        detail: { pos: sug.pos, toPos: sug.toPos, item: sug },
      })
    );
  };

  const TocList = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {toc.map((item) => {
        const isActive = activePos === item.pos;
        const levelIndent = item.level === 1 ? 10 : item.level === 2 ? 18 : 26;
        const fontClass = item.level === 1 ? "font-semibold text-[var(--text-primary)]" : item.level === 2 ? "text-[var(--text-secondary)]" : "text-[var(--text-dim)] text-xs";

        return (
          <button
            key={item.id}
            onClick={() => handleSelectToc(item)}
            style={{ padding: '6px 10px', paddingLeft: `${levelIndent}px` }}
            className={`w-full text-left rounded-lg text-xs transition-all flex items-center gap-2 group ${
              isActive
                ? "bg-[var(--bg-active)] text-[var(--accent)] font-medium"
                : "hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
            } ${fontClass}`}
            title={item.text}
          >
            <span className="truncate flex-1">{item.text || `${t('toc.heading')} ${item.level}`}</span>
          </button>
        );
      })}
    </div>
  );

  const SuggestionsList = () => (
    <div
      style={{
        marginTop: hasToc ? '12px' : '0px',
        paddingTop: hasToc ? '12px' : '0px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
      className={hasToc ? "border-t border-[var(--border-default)]" : ""}
    >
      {hasToc && (
        <div style={{ paddingLeft: '4px', marginBottom: '8px' }} className="flex items-center gap-2">
          <MessageSquare size={14} className="text-amber-500" />
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {t('toc.suggestions')} ({suggestions.length})
          </h4>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {suggestions.map((sug) => {
          const isActive = activePos === sug.pos;
          const isInsert = sug.type === "insert";
          const isDelete = sug.type === "delete";

          const badgeColor = isInsert
            ? "bg-[rgba(16,185,129,0.15)] text-[#10b981]"
            : isDelete
            ? "bg-[rgba(239,68,68,0.15)] text-[#ef4444]"
            : "bg-[rgba(245,158,11,0.15)] text-[#f59e0b]";

          const typeLabel = isInsert ? t('toc.insert') : isDelete ? t('toc.delete') : t('toc.note');
          const Icon = isInsert ? Plus : isDelete ? Minus : FileText;

          return (
            <button
              key={sug.id}
              onClick={() => handleSelectSuggestion(sug)}
              style={{ padding: '8px 10px' }}
              className={`w-full text-left rounded-xl text-xs transition-all flex flex-col gap-1 group ${
                isActive
                  ? "bg-[var(--bg-active)] border border-[var(--accent)]"
                  : "hover:bg-[var(--bg-hover)] border border-transparent"
              }`}
              title={`${sug.authorName}: ${sug.text}`}
            >
              <div className="flex items-center justify-between w-full gap-2">
                <span style={{ padding: '2px 6px' }} className={`inline-flex items-center gap-1 rounded text-[10px] font-semibold ${badgeColor}`}>
                  <Icon size={10} />
                  {typeLabel}
                </span>
                <span className="text-[10px] text-[var(--text-dim)] truncate max-w-[100px]">
                  {sug.authorName}
                </span>
              </div>
              <p className="text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                {sug.text || t('toc.empty')}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );

  const totalCount = (hasToc ? toc.length : 0) + (showSuggestions ? suggestions.length : 0);

  if (variant === "sidebar") {
    return (
      <nav
        style={{ width: '100%', height: '100%' }}
        className={`rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] backdrop-blur-md shadow-lg overflow-hidden flex flex-col ${className}`}
      >
        <div style={{ padding: '16px' }} className="overflow-y-auto flex-1 custom-scrollbar">
          {hasToc && (
            <>
              <div style={{ marginBottom: '12px', paddingBottom: '8px' }} className="flex items-center gap-2 border-b border-[var(--border-default)]">
                <BookOpen size={16} className="text-[var(--accent)]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {t('toc.title')} ({toc.length})
                </h3>
              </div>
              <TocList />
            </>
          )}
          {showSuggestions && <SuggestionsList />}
        </div>
      </nav>
    );
  }

  const showStatsRight = showStats && state.statsLayoutMode === "right";
  const bottomOffset = showStatsRight ? '80px' : '24px';

  return (
    <>
      {/* Floating Action Button */}
      <div style={{ bottom: bottomOffset, right: '32px' }} className={`fixed z-40 ${className}`}>
        <button
          onClick={() => setOpen(!open)}
          style={{ padding: '14px' }}
          className="relative rounded-full bg-[var(--accent)] hover:opacity-90 active:scale-95 text-white shadow-xl shadow-[var(--accent)]/20 transition-all duration-200 flex items-center justify-center group"
          title={hasToc ? t('toc.tocAndSuggestions') : t('toc.suggestions')}
        >
          <List size={20} className="transition-transform group-hover:rotate-6" />
          <span
            style={{ padding: '2px 6px', top: '-4px', right: '-4px' }}
            className="absolute text-[10px] font-bold bg-amber-500 text-white rounded-full border-2 border-[var(--bg-base)]"
          >
            {totalCount}
          </span>
        </button>

        {/* Popover Drawer */}
        {mounted && (
          <div
            style={{ padding: '16px', bottom: '60px', right: '0px', width: '320px', maxHeight: '70vh' }}
            className={`absolute flex flex-col bg-[var(--bg-surface)] backdrop-blur-xl border border-[var(--border-default)] rounded-2xl shadow-2xl z-50 ${
              open
                ? 'animate-in fade-in zoom-in-95 slide-in-from-bottom-3 duration-150 ease-out'
                : 'animate-out fade-out zoom-out-95 slide-out-to-bottom-3 duration-150 ease-in fill-mode-forwards'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: '12px', paddingBottom: '8px' }} className="flex items-center justify-between border-b border-[var(--border-default)]">
              <div className="flex items-center gap-2">
                {hasToc ? (
                  <BookOpen size={16} className="text-[var(--accent)]" />
                ) : (
                  <MessageSquare size={16} className="text-amber-500" />
                )}
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {hasToc
                    ? showSuggestions
                      ? `${t('toc.tocAndSuggestions')} (${totalCount})`
                      : `${t('toc.title')} (${toc.length})`
                    : `${t('toc.suggestions')} (${suggestions.length})`}
                </h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ padding: '4px' }}
                className="rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ paddingRight: '4px' }} className="overflow-y-auto flex-1 custom-scrollbar">
              {hasToc && <TocList />}
              {showSuggestions && <SuggestionsList />}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
