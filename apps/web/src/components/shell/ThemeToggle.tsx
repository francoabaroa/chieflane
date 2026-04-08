"use client";

import { useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type Theme = "light" | "dark" | "system";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "system";
  }

  const stored = localStorage.getItem("theme");
  return stored === "light" || stored === "dark" ? stored : "system";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  const cycle = () => {
    const next: Theme =
      theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);

    const root = document.documentElement;
    root.classList.remove("light", "dark");

    if (next === "system") {
      localStorage.removeItem("theme");
      if (matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      }
    } else {
      localStorage.setItem("theme", next);
      root.classList.add(next);
    }
  };

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const label =
    theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

  return (
    <button
      onClick={cycle}
      className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary"
      aria-label={`Theme: ${label}. Click to change.`}
      type="button"
    >
      <Icon size={14} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
