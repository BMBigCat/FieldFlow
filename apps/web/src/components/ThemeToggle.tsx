import { useTheme } from "../lib/theme-context";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="rounded-md border border-border px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
    >
      {isDark ? "☀️ Light" : "🌙 Dark"}
    </button>
  );
}
