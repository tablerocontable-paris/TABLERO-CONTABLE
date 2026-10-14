import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "system" | "light" | "dark";
const themeOrder: Theme[] = ["system", "light", "dark"];
const themeLabels: Record<Theme, string> = {
  system: "automática",
  light: "clara",
  dark: "oscura",
};
const themeIcons = { system: Monitor, light: Sun, dark: Moon };

export default function ThemeControl() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem("paris-theme");
      return stored === "light" || stored === "dark" ? stored : "system";
    } catch { return "system"; }
  });

  useEffect(() => {
    const mq = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (mq?.matches ? "dark" : "light") : theme;
    };
    apply();
    try { localStorage.setItem("paris-theme", theme); } catch { /* appearance still works for this session */ }
    mq?.addEventListener("change", apply);
    return () => mq?.removeEventListener("change", apply);
  }, [theme]);

  const Icon = themeIcons[theme];
  const nextTheme = themeOrder[(themeOrder.indexOf(theme) + 1) % themeOrder.length];
  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      data-theme={theme}
      aria-label={`Apariencia ${themeLabels[theme]}. Cambiar a ${themeLabels[nextTheme]}`}
      title={`Apariencia ${themeLabels[theme]}`}
      onClick={() => setTheme(nextTheme)}
    >
      <Icon size={17} aria-hidden="true" />
    </button>
  );
}
