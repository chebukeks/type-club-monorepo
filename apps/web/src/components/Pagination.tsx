import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

function pageItems(page: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const wanted = new Set<number>([1, 2, 3, page - 1, page, page + 1, totalPages - 1, totalPages]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const items: (number | "...")[] = [];
  let prev = 0;
  for (const p of pages) {
    if (prev && p - prev > 1) items.push("...");
    items.push(p);
    prev = p;
  }
  return items;
}

export default function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null;

  const btnBase =
    "min-w-9 h-9 px-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center";
  const btnIdle =
    "border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-blue-300 dark:hover:border-blue-700";
  const btnActive = "bg-blue-600 text-white";
  const btnDisabled = "opacity-40 cursor-not-allowed";

  return (
    <nav className="flex items-center justify-center gap-1.5 mt-8 flex-wrap" aria-label="Pagination">
      <button
        className={`${btnBase} ${btnIdle} ${page <= 1 ? btnDisabled : ""}`}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </button>
      {pageItems(page, totalPages).map((item, i) =>
        item === "..." ? (
          <span key={`e${i}`} className="min-w-9 h-9 flex items-center justify-center text-sm text-gray-400 select-none">
            …
          </span>
        ) : (
          <button
            key={item}
            className={`${btnBase} ${item === page ? btnActive : btnIdle}`}
            onClick={() => onChange(item)}
            aria-current={item === page ? "page" : undefined}
          >
            {item}
          </button>
        )
      )}
      <button
        className={`${btnBase} ${btnIdle} ${page >= totalPages ? btnDisabled : ""}`}
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
