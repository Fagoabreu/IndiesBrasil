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
 * @param {boolean} [options.once=false] - Revela uma única vez e para de
 *   observar. Use em revelação de conteúdo: sem isso o elemento volta ao
 *   estado inicial ao sair da viewport e a seção "desaparece" quando o usuário
 *   rola de volta. NÃO use em sentinela de scroll infinito (`pages/posts`,
 *   `pages/membros`), onde voltar a `false` é justamente o que rearma a busca.
 */
export default function useInView(options = {}) {
  const { threshold = 0.2, rootMargin = "0px 0px -70px 0px", once = false } = options;
  const [isVisible, setIsVisible] = useState(false);
  const [node, setNode] = useState(null);

  // Callback ref — React chama com o elemento DOM sempre que monta/desmonta
  const ref = useCallback((el) => {
    setNode(el);
  }, []);

  useEffect(() => {
    if (!node) return;

    // Sem IntersectionObserver não há como detectar visibilidade; expõe o
    // conteúdo para não deixá-lo permanentemente oculto (as classes de reveal
    // partem de `opacity: 0`). setState fica em callback assíncrono porque
    // chamá-lo direto no corpo do efeito dispara renders em cascata.
    if (typeof IntersectionObserver === "undefined") {
      const timeoutId = setTimeout(() => setIsVisible(true), 0);
      return () => clearTimeout(timeoutId);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // `once`: revelou, cumpriu o papel. Sem o disconnect o observer
          // seguiria disparando a cada rolagem, e o `setIsVisible(false)` do
          // caminho abaixo voltaria a esconder a seção.
          if (once) observer.disconnect();
          return;
        }
        setIsVisible(false);
      },
      { threshold, rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [node, threshold, rootMargin, once]);

  return [ref, isVisible];
}
