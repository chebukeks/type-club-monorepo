import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { usersApi, type UserSearchResult } from '../api';
import { Search } from 'lucide-react';

interface Props {
  placeholder?: string;
  onSelect: (nickname: string) => void;
}

export function UserAutocompleteInput({ placeholder = "Поиск пользователя…", onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const users = await usersApi.search(query.trim());
        setResults(users);
        setShowDropdown(true);
        setSelectedIdx(-1);
      } catch {
        setResults([]);
      }
    }, 300);
  }, [query]);

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (nickname: string) => {
    onSelect(nickname);
    setQuery("");
    setResults([]);
    setShowDropdown(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && selectedIdx >= 0 && selectedIdx < results.length) {
      e.preventDefault();
      handleSelect(results[selectedIdx].nickname);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  return (
    <div ref={containerRef} className="autocomplete-container">
      <div className="autocomplete-input-wrap">
        <Search size={14} className="autocomplete-icon" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="autocomplete-input"
        />
      </div>
      {showDropdown && results.length > 0 && (
        <div className="autocomplete-dropdown">
          {results.map((u, i) => (
            <div
              key={u.id}
              className={`autocomplete-item ${i === selectedIdx ? "selected" : ""}`}
              onClick={() => handleSelect(u.nickname)}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              {u.nickname}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
