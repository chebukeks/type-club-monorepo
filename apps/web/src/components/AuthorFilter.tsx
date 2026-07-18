import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { usersApi, UserSuggestion } from "../api";
import { useDebounce } from "../hooks/useDebounce";

interface Props {
  value: string | null;
  onChange: (author: string | null) => void;
}

export default function AuthorFilter({ value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const debouncedQuery = useDebounce(query);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    usersApi
      .search(q)
      .then((users) => {
        if (!cancelled) {
          setSuggestions(users);
          setHighlighted(0);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (nickname: string) => {
    onChange(nickname);
    setQuery("");
    setSuggestions([]);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(suggestions[Math.min(highlighted, suggestions.length - 1)].nickname);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  if (value) {
    return (
      <div className="flex items-center gap-1.5 h-10 px-3 rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950 text-sm shrink-0">
        <span className="text-gray-500">by</span>
        <span className="font-medium">{value}</span>
        <button
          onClick={() => onChange(null)}
          className="ml-1 p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900 text-gray-500"
          aria-label="Clear author filter"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  const showDropdown = open && query.trim().length > 0;

  return (
    <div ref={rootRef} className="relative w-full sm:w-64 shrink-0">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Filter by author..."
        className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm outline-none focus:border-blue-400 dark:focus:border-blue-600 transition-colors"
      />
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg overflow-hidden z-20">
          {suggestions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">No users found</div>
          ) : (
            suggestions.map((u, i) => (
              <button
                key={u.id}
                onClick={() => select(u.nickname)}
                onMouseEnter={() => setHighlighted(i)}
                className={`block w-full text-left px-3 py-2 text-sm transition-colors ${
                  i === highlighted ? "bg-blue-50 dark:bg-blue-950 text-blue-600" : ""
                }`}
              >
                {u.nickname}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
