import PropTypes from "prop-types";

import styles from "./SectionHeading.module.css";

/**
 * Título de bloco com a ação alinhada à direita.
 *
 * Havia `.sectionTitle` em 22 páginas (76 usos) e `.headerTitle` em 7, cada uma
 * com tamanho e margem próprios — o mesmo "Jogos recentes" saía a 1rem numa tela
 * e a 1.15rem noutra. Aqui o tamanho vem do nível (`as`) e o espaço de baixo vem
 * do `Section` que o usa, não do título.
 */
export default function SectionHeading({ as: Title = "h2", title, description, action, eyebrow, id, className }) {
  const rootClassName = [styles.root, className].filter(Boolean).join(" ");
  const titleClassName = [styles.title, Title === "h3" ? styles.titleSm : null].filter(Boolean).join(" ");

  return (
    <div className={rootClassName}>
      <div className={styles.text}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}

        <Title className={titleClassName} id={id}>
          {title}
        </Title>

        {description ? <p className={styles.description}>{description}</p> : null}
      </div>

      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}

SectionHeading.propTypes = {
  /** `h2` por omissão; `h3` quando o bloco já está dentro de outro bloco titulado. */
  as: PropTypes.oneOf(["h2", "h3"]),
  title: PropTypes.node.isRequired,
  description: PropTypes.node,
  /** Botão ou link alinhado à direita ("Ver todos"). */
  action: PropTypes.node,
  /** Micro-rótulo em caixa alta acima do título. */
  eyebrow: PropTypes.string,
  /** Necessário quando o título nomeia a `<section>` que o contém. */
  id: PropTypes.string,
  className: PropTypes.string,
};
