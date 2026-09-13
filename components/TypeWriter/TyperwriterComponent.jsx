import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import style from "./TyperwriterComponent.module.css";
import PropTypes from "prop-types";

TyperwriterComponent.propTypes = {
  initText: PropTypes.string,
  frases: PropTypes.arrayOf(PropTypes.string),
};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// Lido via useSyncExternalStore: SSR-safe (snapshot no servidor = false) e sem
// setState dentro de efeito. Trocar o texto a cada 100–200ms é hostil para
// quem tem sensibilidade vestibular ou usa leitor de tela.
function subscribeReducedMotion(callback) {
  if (typeof window === "undefined") return () => {};
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

export default function TyperwriterComponent({ initText, frases }) {
  const [text, setText] = useState("");
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, getReducedMotionServerSnapshot);

  const frasesRef = useRef(frases);
  const fraseIndex = useRef(0);
  const charIndex = useRef(0);
  const isDeleting = useRef(false);

  useEffect(() => {
    if (reducedMotion) return;
    // Sem frases acessar `.length` estouraria; o guard mantém o componente
    // seguro caso `frases` chegue vazio ou undefined.
    if (!frasesRef.current || frasesRef.current.length === 0) return;

    const currentFrase = frasesRef.current[fraseIndex.current];

    const timeout = setTimeout(
      () => {
        if (isDeleting.current) {
          charIndex.current--;
          setText(currentFrase.substring(0, charIndex.current));
        } else {
          charIndex.current++;
          setText(currentFrase.substring(0, charIndex.current));
        }

        if (!isDeleting.current && charIndex.current === currentFrase.length) {
          isDeleting.current = true;
        } else if (isDeleting.current && charIndex.current === 0) {
          isDeleting.current = false;
          fraseIndex.current = (fraseIndex.current + 1) % frasesRef.current.length;
        }
      },
      isDeleting.current ? 100 : 200,
    );

    return () => clearTimeout(timeout);
  }, [text, reducedMotion]);

  // Movimento reduzido: sem digitação nem cursor piscando — frase estática.
  if (reducedMotion) {
    return (
      <span className={style.typewriterRoot}>
        {initText && <span>{initText} </span>}
        <span className={style.staticText}>{frases?.[0]}</span>
      </span>
    );
  }

  return (
    <span className={style.typewriterRoot}>
      {initText && <span>{initText} </span>}
      <span className={style.typingText}>{text}</span>
    </span>
  );
}
