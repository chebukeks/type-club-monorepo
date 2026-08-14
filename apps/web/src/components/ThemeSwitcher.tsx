import { useState, useRef, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { Moon, Sun, Monitor, Languages, Check } from "lucide-react";
import type { Locale } from "@type-club/editor";

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const themeOptions: { value: "dark" | "light" | "system"; labelKey: "theme.dark" | "theme.light" | "theme.system"; icon: typeof Moon }[] = [
    { value: "dark", labelKey: "theme.dark", icon: Moon },
    { value: "system", labelKey: "theme.system", icon: Monitor },
    { value: "light", labelKey: "theme.light", icon: Sun },
  ];

  const langOptions: { value: Locale; label: string }[] = [
    { value: "en", label: "English" },
    { value: "ru", label: "Русский" },
  ];

  const CurrentIcon = themeOptions.find((o) => o.value === theme)?.icon || Moon;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title={t('theme.title')}
      >
        <CurrentIcon size={18} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-[100] py-1 select-none text-sm">
          {/* Theme Section */}
          <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {t('theme.title')}
          </div>
          {themeOptions.map((o) => (
            <button
              key={o.value}
              onClick={() => { setTheme(o.value); setOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-1.5 transition-colors ${
                theme === o.value
                  ? "bg-gray-100 dark:bg-gray-800 font-medium text-gray-900 dark:text-gray-100"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              }`}
            >
              <span className="flex items-center gap-2">
                <o.icon size={15} className="text-gray-400" />
                {t(o.labelKey)}
              </span>
              {theme === o.value && <Check size={14} className="text-indigo-500" />}
            </button>
          ))}

          <div className="border-t border-gray-200 dark:border-gray-700 my-1 mx-2 opacity-80" />

          {/* Language Section */}
          <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {t('language.title')}
          </div>
          {langOptions.map((l) => (
            <button
              key={l.value}
              onClick={() => { setLanguage(l.value); setOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-1.5 transition-colors ${
                language === l.value
                  ? "bg-gray-100 dark:bg-gray-800 font-medium text-gray-900 dark:text-gray-100"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              }`}
            >
              <span className="flex items-center gap-2">
                <Languages size={15} className="text-gray-400" />
                {l.label}
              </span>
              {language === l.value && <Check size={14} className="text-indigo-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
