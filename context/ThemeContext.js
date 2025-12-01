import { createContext, useContext, useEffect, useState } from "react";
import { useTheme } from "@primer/react";

const ThemeToggleContext = createContext();

export function ThemeProviderCustom({ children }) {
  const { setColorMode } = useTheme();
  const [mode, setMode] = useState("day");

  useEffect(() => {
    const saved = localStorage.getItem("theme-mode");
    const initial = saved ?? "day";

    setMode(initial);
    setColorMode(initial);
  }, []);

  const toggleTheme = () => {
    const next = mode === "day" ? "night" : "day";
    setMode(next);
    setColorMode(next);
    localStorage.setItem("theme-mode", next);
  };

  return <ThemeToggleContext.Provider value={{ mode, toggleTheme }}>{children}</ThemeToggleContext.Provider>;
}

export function useThemeToggle() {
  return useContext(ThemeToggleContext);
}
