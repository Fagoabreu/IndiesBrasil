// context/ThemeContext.js
import React, { createContext, useContext, useEffect, useState } from "react";
import { useTheme } from "@primer/react";

const ThemeContext = createContext();

export function ThemeProviderCustom({ children }) {
  const { colorMode, setColorMode } = useTheme();
  const [ready, setReady] = useState(false);

  // No carregamento do cliente, aplicar o tema salvo
  useEffect(() => {
    // Somente no cliente
    const saved = typeof window !== "undefined" ? localStorage.getItem("theme-mode") : null;
    if (saved && saved !== colorMode) {
      setColorMode(saved);
    }
    // marca que já sincronizamos
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sempre que colorMode mudar, persiste
  useEffect(() => {
    if (typeof window !== "undefined" && colorMode) {
      localStorage.setItem("theme-mode", colorMode);
    }
  }, [colorMode]);

  const toggleTheme = () => {
    setColorMode(colorMode === "day" ? "night" : "day");
  };

  return <ThemeContext.Provider value={{ mode: colorMode, setMode: setColorMode, toggleTheme, ready }}>{children}</ThemeContext.Provider>;
}

export function useThemeToggle() {
  return useContext(ThemeContext);
}
