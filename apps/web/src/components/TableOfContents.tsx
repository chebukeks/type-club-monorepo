import { useState, useEffect } from "react";
import { List, X, BookOpen, MessageSquare, Plus, Minus, FileText } from "lucide-react";
import type { TocItem, SuggestionItem } from "@type-club/editor";
import { useLanguage } from "../context/LanguageContext";

interface TableOfContentsProps {
  toc: TocItem[];
  suggestions?: SuggestionItem[];
  isEditor?: boolean;
  variant?: "floating" | "sidebar";
  className?: string;
}

export default function TableOfContents({
  toc,
  suggestions = [],
  isEditor = false,
  variant = "floating",
  className = "",
}: TableOfContentsProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [activePos, setActivePos] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  const hasToc = toc && toc.length > 0;
  const showSuggestions = isEditor && suggestions && suggestions.length > 0;

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
    <div className="space-y-0.5">
      {toc.map((item) => {
        const isActive = activePos === item.pos;
        const levelIndent = item.level === 1 ? 10 : item.level === 2 ? 18 : 26;
        const fontClass =
          item.level === 1
            ? "font-semibold text-gray-900 dark:text-gray-100"
            : item.level === 2
            ? "text-gray-700 dark:text-gray-300"
            : "text-gray-500 dark:text-gray-400 text-xs";

        return (
          <button
            key={item.id}
            onClick={() => handleSelectToc(item)}
            style={{ padding: '6px 10px', paddingLeft: `${levelIndent}px` }}
            className={`w-full text-left rounded-lg text-sm transition-all flex items-center gap-2 group ${
              isActive
                ? "bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-medium shadow-xs"
                : "hover:bg-gray-100/80 dark:hover:bg-gray-800/60"
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
    <div className={`space-y-1 ${hasToc ? "mt-3 pt-3 border-t border-gray-200/80 dark:border-gray-800/80" : ""}`}>
      {hasToc && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <MessageSquare size={14} className="text-amber-500" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {t('toc.suggestions')} ({suggestions.length})
          </h4>
        </div>
      )}
      <div className="space-y-1">
        {suggestions.map((sug) => {
          const isActive = activePos === sug.pos;
          const isInsert = sug.type === "insert";
          const isDelete = sug.type === "delete";

          const badgeColor = isInsert
            ? "bg-green-100 text-green-700 dark:bg-green-950/80 dark:text-green-400"
            : isDelete
            ? "bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-400"
            : "bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400";

          const typeLabel = isInsert ? t('toc.insert') : isDelete ? t('toc.delete') : t('toc.note');
          const Icon = isInsert ? Plus : isDelete ? Minus : FileText;

          return (
            <button
              key={sug.id}
              onClick={() => handleSelectSuggestion(sug)}
              className={`w-full text-left p-2 rounded-lg text-xs transition-all flex flex-col gap-1 group ${
                isActive
                  ? "bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800"
                  : "hover:bg-gray-100/80 dark:hover:bg-gray-800/60 border border-transparent"
              }`}
              title={`${sug.authorName}: ${sug.text}`}
            >
              <div className="flex items-center justify-between w-full gap-2">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${badgeColor}`}>
                  <Icon size={10} />
                  {typeLabel}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[100px]">
                  {sug.authorName}
                </span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 line-clamp-2 leading-relaxed">
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
      <nav className={`w-full h-full overflow-hidden rounded-2xl border border-gray-200/80 dark:border-gray-800/80 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-xs flex flex-col ${className}`}>
        <div className="overflow-y-auto flex-1 p-4 custom-scrollbar">
          {hasToc && (
            <>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-gray-800/80">
                <BookOpen size={16} className="text-blue-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('toc.title')}</h3>
              </div>
              <TocList />
            </>
          )}
          {showSuggestions && <SuggestionsList />}
        </div>
      </nav>
    );
  }

  return (
    <>
      {/* Floating Action Button */}
      <div className={`fixed bottom-6 right-6 z-40 ${className}`}>
        <button
          onClick={() => setOpen(!open)}
          className="relative p-3.5 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-xl shadow-blue-500/25 transition-all duration-200 flex items-center justify-center group"
          title={t('toc.tocAndSuggestions')}
        >
          <List size={20} className="transition-transform group-hover:rotate-6" />
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full border-2 border-white dark:border-gray-950">
            {totalCount}
          </span>
        </button>

        {/* Popover / Sheet Drawer */}
        {mounted && (
          <div
            className={`absolute bottom-16 right-0 w-80 max-h-[70vh] flex flex-col bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80 rounded-2xl shadow-2xl z-50 p-4 ${
              open
                ? "animate-in fade-in zoom-in-95 slide-in-from-bottom-3 duration-150 ease-out"
                : "animate-out fade-out zoom-out-95 slide-out-to-bottom-3 duration-150 ease-in fill-mode-forwards"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                {hasToc ? (
                  <BookOpen size={16} className="text-blue-500" />
                ) : (
                  <MessageSquare size={14} className="text-amber-500" />
                )}
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {hasToc
                    ? showSuggestions
                      ? `${t('toc.tocAndSuggestions')} (${totalCount})`
                      : `${t('toc.title')} (${toc.length})`
                    : `${t('toc.suggestions')} (${suggestions.length})`}
                </h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
              {hasToc && <TocList />}
              {showSuggestions && <SuggestionsList />}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
