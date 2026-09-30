import { useEffect, useState } from "react";
export default function ThemeControl() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("paris-theme") || "system",
  );
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (mq.matches ? "dark" : "light") : theme;
    };
    apply();
    localStorage.setItem("paris-theme", theme);
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  return (
    <select
      aria-label="Apariencia"
      className="theme-control"
      value={theme}
      onChange={(e) => setTheme(e.target.value)}
    >
      <option value="system">◐ Sistema</option>
      <option value="light">☀ Claro</option>
      <option value="dark">☾ Oscuro</option>
    </select>
  );
}
