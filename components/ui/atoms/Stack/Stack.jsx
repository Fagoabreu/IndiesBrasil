import PropTypes from "prop-types";

import styles from "./Stack.module.css";

/**
 * Empilhamento vertical com o espaço vindo da escala de tokens.
 *
 * O espaçamento entre blocos era a decisão mais repetida e menos consistente do
 * frontend: cada `.page` escolhia `12px`, `16px` ou `24px` para o mesmo tipo de
 * separação, e `Stack` existe para que a resposta seja sempre um token.
 */
export default function Stack({ gap = 4, as: As = "div", align, className, style, children }) {
  const rootClassName = [styles.root, className].filter(Boolean).join(" ");

  return (
    <As className={rootClassName} style={{ "--stack-gap": `var(--space-${gap})`, "--stack-align": align, ...style }}>
      {children}
    </As>
  );
}

Stack.propTypes = {
  /** Degrau da escala `--space-*`. */
  gap: PropTypes.oneOf([1, 2, 3, 4, 5, 6, 8, 12]),
  as: PropTypes.elementType,
  /** `align-items` do eixo transversal. */
  align: PropTypes.oneOf(["stretch", "flex-start", "center", "flex-end"]),
  className: PropTypes.string,
  style: PropTypes.object,
  children: PropTypes.node,
};
