import { useState, useEffect, useRef } from "react";
import { usersApi, UserSuggestion } from "../api";
import { useDebounce } from "../hooks/useDebounce";

interface UserAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (nickname: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function UserAutocompleteInput({
  value,
  onChange,
  onSelect,
  onSubmit,
  placeholder = "Никнейм пользователя",
  className = "",
  disabled = false,
}: UserAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const debouncedQuery = useDebounce(value);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    usersApi
      .search(q, 6)
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
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (nickname: string) => {
    onChange(nickname);
    if (onSelect) onSelect(nickname);
    setSuggestions([]);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (open && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        select(suggestions[Math.min(highlighted, suggestions.length - 1)].nickname);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      setOpen(false);
      if (onSubmit) onSubmit();
    }
  };

  const showDropdown = open && value.trim().length > 0;

  return (
    <div ref={rootRef} className={`relative flex-1 ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-gray-400"
      />
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl overflow-hidden z-50 max-h-48 overflow-y-auto">
          {suggestions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">Пользователи не найдены</div>
          ) : (
            suggestions.map((u, i) => (
              <button
                key={u.id}
                type="button"
                onClick={() => select(u.nickname)}
                onMouseEnter={() => setHighlighted(i)}
                className={`block w-full text-left px-3 py-1.5 text-xs transition-colors ${
                  i === highlighted
                    ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-medium"
                    : "text-gray-700 dark:text-gray-300"
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
