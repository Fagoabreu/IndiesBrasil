import { useRef } from "react";
import PropTypes from "prop-types";

import styles from "./TabBar.module.css";

/**
 * Abas de listagem ("Descubra" / "Seguindo").
 *
 * Existiam cinco cópias (jogos, quadrinhos, jogos-de-mesa, estúdios, membros)
 * com a mesma pílula de `border-radius: 999px` e o mesmo gradiente suave no
 * item ativo. Aqui o alvo é retângulo de raio pequeno com preenchimento sólido
 * — mais legível e o único lugar a mudar quando o desenho mudar.
 *
 * Teclado: setas movem a seleção e o foco (padrão ARIA de `tablist`), porque
 * `role="tab"` promete navegação por seta e `tabIndex={-1}` nos inativos
 * impede que o Tab percorra todos.
 */
export default function TabBar({ items, value, onChange, ariaLabel, className }) {
  const listRef = useRef(null);

  function focusTab(index) {
    const buttons = listRef.current ? listRef.current.querySelectorAll('[role="tab"]') : [];
    if (buttons[index]) buttons[index].focus();
  }

  function handleKeyDown(event) {
    const current = items.findIndex((item) => item.id === value);
    if (current < 0) return;

    let next = null;

    if (event.key === "ArrowRight") next = (current + 1) % items.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;

    if (next === null) return;

    event.preventDefault();
    onChange(items[next].id);
    focusTab(next);
  }

  return (
    <div
      ref={listRef}
      className={[styles.tabList, className].filter(Boolean).join(" ")}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
    >
      {items.map((item) => {
        const active = item.id === value;

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={`${styles.tab} ${active ? styles.tabActive : ""}`}
            onClick={() => onChange(item.id)}
          >
            {item.icon ? <span className={styles.icon}>{item.icon}</span> : null}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

TabBar.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.node.isRequired,
      icon: PropTypes.node,
    }),
  ).isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  ariaLabel: PropTypes.string,
  className: PropTypes.string,
};
