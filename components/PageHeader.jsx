import PropTypes from "prop-types";

import styles from "./PageHeader.module.css";

/**
 * Cabeçalho de página compartilhado pelas listagens e pelas ferramentas.
 *
 * Antes cada tela tinha a sua cópia (`jogos`, `membros`, `quadrinhos`,
 * `jogos-de-mesa`, `streams`, `estudios`, `estudos`, `agenda` e as cinco de
 * `ferramentas`): todas com cartão de fundo ambient, barra gradiente de 3px e
 * título com gradiente. Onze cópias que divergiam em raio, padding e tamanho.
 *
 * `variant="bare"` (padrão) não desenha moldura — o cabeçalho pertence à
 * página, não é um card. Use `"card"` só quando a tela é um bloco solto no
 * meio de outra coisa (ferramentas).
 */
export default function PageHeader({ eyebrow, title, subtitle, badge, tabs, actions, children, titleAs: Title = "h1", variant = "bare", className }) {
  const rootClassName = [styles.root, variant === "card" ? styles.card : null, className].filter(Boolean).join(" ");

  return (
    <header className={rootClassName}>
      <div className={styles.top}>
        <div className={styles.headingBlock}>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}

          <div className={styles.titleRow}>
            <Title className={styles.title}>{title}</Title>
            {badge ? (
              <span className={styles.badge} aria-live="polite">
                {badge}
              </span>
            ) : null}
          </div>

          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>

        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>

      {tabs ? <div className={styles.tabs}>{tabs}</div> : null}
      {children ? <div className={styles.toolbar}>{children}</div> : null}
    </header>
  );
}

PageHeader.propTypes = {
  /** Micro-rótulo em caixa alta acima do título ("Descobrir", "Ferramentas"). */
  eyebrow: PropTypes.string,
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  /** Contador ao lado do título. Recebe `aria-live` porque muda com os filtros. */
  badge: PropTypes.node,
  /** Uma TabBar, tipicamente. */
  tabs: PropTypes.node,
  /** Botões alinhados à direita do título. */
  actions: PropTypes.node,
  /** Barra de busca e filtros. */
  children: PropTypes.node,
  titleAs: PropTypes.oneOf(["h1", "h2"]),
  variant: PropTypes.oneOf(["bare", "card"]),
  className: PropTypes.string,
};
