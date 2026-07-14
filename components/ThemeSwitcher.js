import { useEffect } from "react";
import { parse, serialize } from "cookie";
import { useTheme } from "@primer/react";
import { SunIcon, MoonIcon } from "@primer/octicons-react";
import styles from "./ThemeSwitcher.module.css";

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
  const isDay = resolvedColorMode === "day";

  // Restaura preferência do cookie após hidratação.
  useEffect(() => {
    const saved = readThemeCookie();
    if (saved) setColorMode(saved);
  }, [setColorMode]);

  const handleToggle = () => {
    const newMode = isDay ? "night" : "day";
    setColorMode(newMode);
    saveThemeCookie(newMode);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDay}
      aria-label={isDay ? "Ativar modo escuro" : "Ativar modo claro"}
      data-mode={resolvedColorMode}
      className={styles.toggle}
      onClick={handleToggle}
    >
      <span
        className={`${styles.knob} ${isDay ? styles.knobDay : styles.knobNight}`}
      >
        {isDay ? <SunIcon size={12} /> : <MoonIcon size={12} />}
      </span>
    </button>
  );
};

export default ThemeSwitcher;
