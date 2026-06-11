import { useEffect, useRef } from "react";

/**
 * Hook que aplica efeito tilt 3D + glare em um elemento.
 * Segue a técnica descrita em dev.to/smpnjn/making-3d-css-flippable-cards-3nbl
 */
export default function useTiltEffect(options = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const { max = 10, perspective = 800, scale = 1.02, speed = 300, glare = true, maxGlare = 0.15 } = options;

    let glareEl = null;

    // Cria o elemento de glare se necessário
    if (glare) {
      glareEl = document.createElement("div");
      glareEl.className = "tilt-glare";
      Object.assign(glareEl.style, {
        position: "absolute",
        inset: "0",
        borderRadius: "inherit",
        pointerEvents: "none",
        zIndex: "3",
        background: "linear-gradient(135deg, rgba(255,255,255,0.25) 0%, transparent 50%, rgba(255,255,255,0.05) 100%)",
        opacity: "0",
        transition: `opacity ${speed}ms ease`,
      });
      el.appendChild(glareEl);
    }

    // Garante perspective no pai
    const parent = el.parentElement;
    if (parent) {
      parent.style.perspective = `${perspective}px`;
    }

    const onMouseEnter = () => {
      el.style.transition = `transform ${speed}ms ease, box-shadow ${speed}ms ease`;
      if (glareEl) glareEl.style.transition = `opacity ${speed}ms ease`;
    };

    const onMouseMove = (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -max;
      const rotateY = ((x - centerX) / centerX) * max;

      el.style.transition = "none";
      el.style.transform = `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale}, ${scale}, ${scale})`;

      // Glare — segue o mouse
      if (glareEl) {
        glareEl.style.transition = "none";
        glareEl.style.opacity = `${maxGlare}`;
        const glareX = (x / rect.width) * 100;
        const glareY = (y / rect.height) * 100;
        glareEl.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.2) 0%, transparent 60%)`;
      }
    };

    const onMouseLeave = () => {
      el.style.transition = `transform ${speed}ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow ${speed}ms ease`;
      el.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;

      if (glareEl) {
        glareEl.style.transition = `opacity ${speed}ms ease`;
        glareEl.style.opacity = "0";
      }
    };

    el.addEventListener("mouseenter", onMouseEnter);
    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("mouseleave", onMouseLeave);

    return () => {
      el.removeEventListener("mouseenter", onMouseEnter);
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mouseleave", onMouseLeave);
      if (glareEl && glareEl.parentElement === el) {
        el.removeChild(glareEl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref;
}
