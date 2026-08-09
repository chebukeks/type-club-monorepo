import { useState, useEffect } from "react";
import { List, X, BookOpen } from "lucide-react";
import type { TocItem } from "@type-club/editor";

interface TableOfContentsProps {
  toc: TocItem[];
  variant?: "floating" | "sidebar";
  className?: string;
}

export default function TableOfContents({ toc, variant = "floating", className = "" }: TableOfContentsProps) {
  const [open, setOpen] = useState(false);
  const [activePos, setActivePos] = useState<number | null>(null);

  useEffect(() => {
    if (toc.length > 0 && activePos === null) {
      setActivePos(toc[0].pos);
    }
  }, [toc, activePos]);

  if (!toc || toc.length === 0) return null;

  const handleSelect = (item: TocItem) => {
    setActivePos(item.pos);
    window.dispatchEvent(new CustomEvent("editor-scroll-to", { detail: { pos: item.pos } }));
    if (variant === "floating") {
      setOpen(false);
    }
  };

  const TocList = () => (
    <div className="space-y-0.5">
      {toc.map((item) => {
        const isActive = activePos === item.pos;
        const indentClass =
          item.level === 1
            ? "font-semibold text-gray-900 dark:text-gray-100 pl-2"
            : item.level === 2
            ? "text-gray-700 dark:text-gray-300 pl-5"
            : "text-gray-500 dark:text-gray-400 pl-8 text-xs";

        return (
          <button
            key={item.id}
            onClick={() => handleSelect(item)}
            className={`w-full text-left py-1.5 px-2.5 rounded-lg text-sm transition-all flex items-center gap-2 group ${
              isActive
                ? "bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-medium shadow-xs"
                : "hover:bg-gray-100/80 dark:hover:bg-gray-800/60"
            } ${indentClass}`}
            title={item.text}
          >
            <span className="truncate flex-1">{item.text || `Heading ${item.level}`}</span>
          </button>
        );
      })}
    </div>
  );

  if (variant === "sidebar") {
    return (
      <nav className={`w-64 max-h-[calc(100vh-8rem)] overflow-y-auto p-4 rounded-2xl border border-gray-200/80 dark:border-gray-800/80 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-xs ${className}`}>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-gray-800/80">
          <BookOpen size={16} className="text-blue-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Оглавление</h3>
        </div>
        <TocList />
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
          title="Оглавление"
        >
          <List size={20} className="transition-transform group-hover:rotate-6" />
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full border-2 border-white dark:border-gray-950">
            {toc.length}
          </span>
        </button>

        {/* Popover / Sheet Drawer */}
        {open && (
          <div
            className="absolute bottom-16 right-0 w-80 max-h-[70vh] flex flex-col bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80 rounded-2xl shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-bottom-3 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-blue-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Оглавление ({toc.length})
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
              <TocList />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
