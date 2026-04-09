"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", mode === "dark");
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const saved = localStorage.getItem("sellscope-theme");
    const preferred =
      saved === "light" || saved === "dark"
        ? saved
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setMode(preferred);
    applyTheme(preferred);
  }, []);

  function toggleTheme() {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    applyTheme(next);
    localStorage.setItem("sellscope-theme", next);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-xs text-neutral-700 transition-colors hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
    >
      {mode === "dark" ? "Light" : "Dark"}
    </button>
  );
}
