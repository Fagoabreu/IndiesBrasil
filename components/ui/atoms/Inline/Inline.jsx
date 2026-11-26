import PropTypes from "prop-types";

import styles from "./Inline.module.css";

/**
 * Linha horizontal com quebra automática e espaço da escala de tokens.
 *
 * É o antídoto para `.actions`, `.toolbar`, `.controls` e `.footer` — quatro
 * nomes para a mesma linha de botões, cada um com o seu `gap` (4/6/8/10px) e o
 * seu `flex-wrap`. `wrap` existe porque a barra de filtros de `/servicos`
 * precisa de ficar numa linha só, enquanto um grupo de ações tem de quebrar a
 * 360px.
 */
export default function Inline({ gap = 2, as: As = "div", align = "center", justify = "flex-start", wrap = true, className, style, children }) {
  const rootClassName = [styles.root, wrap ? null : styles.nowrap, className].filter(Boolean).join(" ");

  return (
    <As
      className={rootClassName}
      style={{
        "--inline-gap": `var(--space-${gap})`,
        "--inline-align": align,
        "--inline-justify": justify,
        ...style,
      }}
    >
      {children}
    </As>
  );
}

Inline.propTypes = {
  /** Degrau da escala `--space-*`. */
  gap: PropTypes.oneOf([1, 2, 3, 4, 5, 6, 8, 12]),
  as: PropTypes.elementType,
  align: PropTypes.oneOf(["stretch", "flex-start", "center", "flex-end", "baseline"]),
  justify: PropTypes.oneOf(["flex-start", "center", "flex-end", "space-between", "space-around"]),
  /** `false` mantém tudo numa linha (barra de filtros). */
  wrap: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object,
  children: PropTypes.node,
};
