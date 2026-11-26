import PropTypes from "prop-types";

import styles from "./PageShell.module.css";

/** Classe por largura. Mapa explícito, e não `styles[width]`, para o
 *  `audit-css-modules` conseguir ver as três classes usadas no ficheiro. */
const WIDTH_CLASS = {
  content: styles.content,
  wide: styles.wide,
  form: styles.form,
  full: styles.full,
};

/**
 * Conteúdo de uma página: uma largura e um ritmo vertical, nada mais.
 *
 * Antes cada tela declarava o próprio contentor — `.page` com 1300, 1200, 1100,
 * 1040, 900, 860, 840, 820, 800 ou 720px (65 módulos em `pages/`, 139
 * `max-width`) — e as doze telas de admin usavam outro shell, o `PageLayout` do
 * Primer. O efeito era o mesmo bloco a saltar de largura ao navegar entre
 * listagens e a margem lateral a ser somada duas vezes na mesma rota.
 *
 * A largura é da família de páginas, não da página: `wide` para grelha de 3-4
 * colunas, `content` para feed e texto corrido, `form` para formulário e
 * configurações, `full` para a home (que tem shell próprio).
 *
 * Padding lateral não entra aqui: o `.main-content` do `Layout` já aplica
 * `clamp(10px, 2.3vw, 20px)`. Repeti-lo era o que fazia `configuracoes` somar
 * 16px aos 20px do shell em ecrã largo.
 */
export default function PageShell({ width = "content", as: As = "div", children, className }) {
  const rootClassName = [styles.root, WIDTH_CLASS[width], className].filter(Boolean).join(" ");

  return <As className={rootClassName}>{children}</As>;
}

PageShell.propTypes = {
  /** Largura da família: `content` (feed/texto), `wide` (grelha), `form`, `full`. */
  width: PropTypes.oneOf(["content", "wide", "form", "full"]),
  as: PropTypes.elementType,
  children: PropTypes.node,
  className: PropTypes.string,
};
