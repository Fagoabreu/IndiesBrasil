import { useRef, useState, useEffect } from "react";

/**
 * Hook que observa a visibilidade de um elemento.
 * Retorna [ref, isVisible], onde isVisible reflete SE o elemento
 * está dentro da viewport no momento.
 *
 * @param {object} options - Opções do IntersectionObserver
 * @param {number} [options.threshold=0.1] - Percentual visível para considerar "visível"
 * @param {string} [options.rootMargin="0px 0px -80px 0px"] - Margem extra
 */
export default function useInView(options = {}) {
  const { threshold = 0.1, rootMargin = "0px 0px -80px 0px" } = options;
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return [ref, isVisible];
}
