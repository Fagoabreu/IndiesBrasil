import PropTypes from "prop-types";

import { SectionHeading } from "@/components/ui/atoms";

import styles from "./Section.module.css";

/**
 * Bloco de página: título, ação e corpo, com o mesmo intervalo entre blocos.
 *
 * Substitui o `<div className={styles.section}>` + `<h2 className={styles
 * .sectionTitle}>` que cada tela repetia (17 páginas com `.section`, 22 com
 * `.sectionTitle`). O intervalo de baixo vem de `--section-gap`; nenhuma página
 * deve voltar a decidir isso.
 *
 * `Section` é o primeiro organismo composto por um átomo nosso
 * (`SectionHeading`) — e não por JSX próprio —, o que faz dele o teste da regra
 * "baixo não conhece alto": o átomo não sabe que existe uma `Section`.
 */
export default function Section({ title, description, action, eyebrow, titleAs = "h2", headingId, spacing = "lg", className, children }) {
  const rootClassName = [styles.root, spacing === "none" ? styles.noSpacing : null, className].filter(Boolean).join(" ");

  return (
    <section className={rootClassName} aria-labelledby={headingId}>
      {title ? <SectionHeading as={titleAs} title={title} description={description} action={action} eyebrow={eyebrow} id={headingId} /> : null}

      {children ? <div className={styles.body}>{children}</div> : null}
    </section>
  );
}

Section.propTypes = {
  title: PropTypes.node,
  description: PropTypes.node,
  action: PropTypes.node,
  eyebrow: PropTypes.string,
  titleAs: PropTypes.oneOf(["h2", "h3"]),
  /** Id do título; liga a `<section>` ao cabeçalho para leitores de ecrã. */
  headingId: PropTypes.string,
  /** `lg` aplica `--section-gap`; `none` para o último bloco da página. */
  spacing: PropTypes.oneOf(["lg", "none"]),
  className: PropTypes.string,
  children: PropTypes.node,
};
