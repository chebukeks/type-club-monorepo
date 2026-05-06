import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeState>(null!);

function getStoredTheme(): Theme {
  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "light" || stored === "system") return stored;
  return "dark";
}

function applyTheme(theme: Theme) {
  const html = document.documentElement;
  if (theme === "system") {
    html.setAttribute("data-theme", "system");
  } else {
    html.setAttribute("data-theme", theme);
  }
  // Also set Tailwind's dark class for utilities like dark:bg-*
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  html.classList.toggle("dark", isDark);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, _setTheme] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (t: Theme) => {
    _setTheme(t);
    localStorage.setItem("theme", t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
