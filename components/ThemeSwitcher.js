import { useEffect } from "react";
import { parse, serialize } from "cookie";
import { useTheme, IconButton } from "@primer/react";
import { SunIcon, MoonIcon } from "@primer/octicons-react";

const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 ano

function saveThemeCookie(mode) {
  document.cookie = serialize("theme-mode", mode, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
    secure: globalThis.location?.protocol === "https:",
  });
}

function readThemeCookie() {
  const cookies = parse(document.cookie);
  const value = cookies["theme-mode"];
  return value === "day" || value === "night" ? value : null;
}

const ThemeSwitcher = () => {
  const { resolvedColorMode, setColorMode } = useTheme();

  // Restaura preferência do cookie após hidratação.
  // useEffect roda apenas no cliente — sem hydration mismatch.
  useEffect(() => {
    const saved = readThemeCookie();
    if (saved) setColorMode(saved);
  }, [setColorMode]);

  const handleThemeChange = () => {
    const newMode = resolvedColorMode === "day" ? "night" : "day";
    setColorMode(newMode);
    saveThemeCookie(newMode);
  };

  return <IconButton icon={resolvedColorMode === "day" ? MoonIcon : SunIcon} onClick={handleThemeChange} aria-label="Alternar tema" />;
};

export default ThemeSwitcher;
