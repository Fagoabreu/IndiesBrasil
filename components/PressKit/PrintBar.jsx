import PropTypes from "prop-types";
import styles from "./PrintBar.module.css";

/**
 * Barra de ação do topo dos documentos imprimíveis (press kits e currículo).
 *
 * Existe porque o bloco — barra fixa, dica, botão e o `window.print()` que troca
 * o `document.title` para o nome do arquivo — estava copiado em três páginas.
 * Cada cópia tinha o seu `@media print { display: none }`, e uma delas ficando
 * para trás apareceria **dentro** do PDF.
 *
 * O nome do arquivo sai do `document.title` no momento da impressão, porque é o
 * navegador que o usa em "Salvar como PDF". Restaurar depois mantém a aba com o
 * título da página.
 */
export default function PrintBar({ documentTitle, children, links = [], buttonLabel = "⬇ Imprimir / Salvar PDF" }) {
  function handlePrint() {
    const previous = document.title;
    document.title = documentTitle;
    globalThis.print();
    document.title = previous;
  }

  return (
    <div className={styles.bar}>
      <p className={styles.hint}>
        {children}
        {links.map((link) => (
          <span key={link.href}>
            {" · "}
            <a
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              className={styles.link}
            >
              {link.label}
            </a>
          </span>
        ))}
      </p>
      <button type="button" className={styles.button} onClick={handlePrint}>
        {buttonLabel}
      </button>
    </div>
  );
}

PrintBar.propTypes = {
  /** Nome sugerido do arquivo (vai para o `document.title` durante a impressão). */
  documentTitle: PropTypes.string.isRequired,
  /** Texto da dica, à esquerda. */
  children: PropTypes.node,
  /** Atalhos ao lado da dica. */
  links: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      href: PropTypes.string.isRequired,
      external: PropTypes.bool,
    }),
  ),
  buttonLabel: PropTypes.string,
};
