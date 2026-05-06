import { useState, useRef, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { Moon, Sun, Monitor } from "lucide-react";

const options: { value: "dark" | "light" | "system"; label: string; icon: typeof Moon }[] = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Auto", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
];

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const CurrentIcon = options.find((o) => o.value === theme)?.icon || Moon;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title="Theme"
      >
        <CurrentIcon size={18} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-[100] py-1">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => { setTheme(o.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                theme === o.value
                  ? "bg-gray-100 dark:bg-gray-800 font-medium"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
              }`}
            >
              <o.icon size={16} />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
