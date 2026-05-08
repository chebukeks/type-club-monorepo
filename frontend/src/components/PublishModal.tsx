import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { X, Copy, Check } from "lucide-react";

interface PublishModalProps {
  currentState: string;
  currentSlug: string;
  onApply: (accessState: string, slug: string) => void;
  onClose: () => void;
}

const states = [
  { value: "private", label: "Private", desc: "Only you can see it" },
  { value: "link", label: "Link access", desc: "Anyone with the link" },
  { value: "public", label: "Public", desc: "Visible on the articles page" },
];

const VALID_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function slugError(s: string): string | null {
  if (!s.trim()) return "Slug cannot be empty";
  if (!VALID_SLUG.test(s)) return "Use only a–z, 0–9, and hyphens (not at start/end, no consecutive)";
  if (s.length > 80) return "Slug is too long (max 80)";
  return null;
}

export default function PublishModal({
  currentState,
  currentSlug,
  onApply,
  onClose,
}: PublishModalProps) {
  const { user } = useAuth();
  const username = user?.nickname || "username";
  const [accessState, setAccessState] = useState(currentState);
  const [slug, setSlug] = useState(currentSlug);
  const [copied, setCopied] = useState(false);

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const filtered = raw.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/--+/g, "-");
    if (filtered.length <= 80) setSlug(filtered);
  };

  const finalSlug = slug.trim() || _slugify("untitled");
  const error = slugError(finalSlug);

  const handleApply = () => {
    if (error) return;
    onApply(accessState, finalSlug);
    onClose();
  };

  const handleCopy = () => {
    const url = `https://type-club.ru/${username}/${finalSlug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">Publish Settings</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 mb-6">
          {states.map((s) => (
            <button
              key={s.value}
              onClick={() => setAccessState(s.value)}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${
                accessState === s.value
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950 dark:border-blue-600"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
              }`}
            >
              <div className="font-medium text-sm">{s.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
            </button>
          ))}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Article slug</label>
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <span>type-club.ru/{username}/</span>
            <input
              type="text"
              value={slug}
              onChange={handleSlugChange}
              className={`flex-1 px-2 py-1 rounded border bg-transparent text-gray-900 dark:text-gray-100 outline-none transition-colors ${
                error ? "border-red-400 dark:border-red-600" : "border-gray-200 dark:border-gray-700 focus:border-blue-500"
              }`}
              placeholder="my-article"
            />
            <button
              onClick={handleCopy}
              className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              title="Copy link"
            >
              {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            </button>
          </div>
          {error && (
            <p className="text-red-500 text-xs mt-1">{error}</p>
          )}
        </div>

        <button
          onClick={handleApply}
          disabled={!!error}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

function _slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[-\s]+/g, "-");
}
