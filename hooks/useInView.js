import { useState, useEffect, useCallback } from "react";

/**
 * Hook que observa a visibilidade de um elemento.
 * Retorna [ref, isVisible], onde isVisible reflete SE o elemento
 * está dentro da viewport no momento.
 *
 * Usa callback ref para reagir quando o elemento DOM é montado/desmontado,
 * essencial para cenários de renderização condicional/lazy.
 *
 * @param {object} options - Opções do IntersectionObserver
 * @param {number} [options.threshold=0.2] - Percentual visível para considerar "visível"
 * @param {string} [options.rootMargin="0px 0px -70px 0px"] - Margem extra
 */
export default function useInView(options = {}) {
  const { threshold = 0.2, rootMargin = "0px 0px -70px 0px" } = options;
  const [isVisible, setIsVisible] = useState(false);
  const [node, setNode] = useState(null);

  // Callback ref — React chama com o elemento DOM sempre que monta/desmonta
  const ref = useCallback((el) => {
    setNode(el);
  }, []);

  useEffect(() => {
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold, rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [node, threshold, rootMargin]);

  return [ref, isVisible];
}
