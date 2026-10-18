import Link from "next/link";
import PropTypes from "prop-types";
import styles from "./StudioActionButton.module.css";

/**
 * Botão de ação do cabeçalho do estúdio (Press Kit, Loja, Pedidos, Reuniões,
 * Editar). Existe para os cinco terem a mesma aparência e, quando for o caso, o
 * mesmo estado **desabilitado**.
 *
 * `disabled` troca o `<Link>` por um `<button disabled>`: link **não tem** estado
 * desabilitado — com `aria-disabled` e `href` ele continuaria navegável por
 * clique, teclado e "abrir em nova aba", prometendo algo que o navegador não
 * cumpre. Hoje é usado pela Loja e pelos Pedidos enquanto a loja não está pronta
 * (a alavanca é `STORE_SALES_ENABLED`, em `lib/store-constants.js`).
 *
 * O rótulo também fica visível no estado desabilitado — esconder o botão faria a
 * loja parecer inexistente, e a intenção é anunciar que ela vem.
 */
export default function StudioActionButton({ href, icon, label, disabled = false, disabledHint, external = false }) {
  const content = (
    <>
      {icon}
      {label}
    </>
  );

  if (disabled) {
    return (
      <button type="button" className={`${styles.btnOutline} ${styles.btnOutlineDisabled}`} disabled title={disabledHint}>
        {content}
      </button>
    );
  }

  return (
    <Link href={href} className={styles.btnOutline} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
      {content}
    </Link>
  );
}

StudioActionButton.propTypes = {
  /** Destino. Ignorado quando `disabled`. */
  href: PropTypes.string,
  /** Ícone do Octicons já renderizado. */
  icon: PropTypes.node,
  label: PropTypes.string.isRequired,
  disabled: PropTypes.bool,
  /** Texto do `title` no estado desabilitado — explica por que não dá para clicar. */
  disabledHint: PropTypes.string,
  /** Abre em nova aba (Press Kit). */
  external: PropTypes.bool,
};
