import Link from "next/link";
import PropTypes from "prop-types";
import { DownloadIcon } from "@primer/octicons-react";
import styles from "./PressKitButton.module.css";

/**
 * Atalho para o press kit do produto, exibido na página do jogo, do jogo de
 * mesa e do quadrinho.
 *
 * `target="_blank"` de propósito: o documento é uma folha para imprimir, e o
 * jornalista precisa dela **aberta ao lado** da página que estava lendo. Sem
 * isso, o botão tira a pessoa do produto e o histórico do navegador vira a
 * única volta. É o mesmo comportamento do press kit do estúdio
 * (`StudioActionButton`, `external`).
 *
 * `variant="solid"` existe para a barra de ações do quadrinho, que é um
 * `<div>` de botões lado a lado (o contorno ali se perderia no meio dos outros).
 */
export default function PressKitButton({ href, variant = "outline", label = "Press Kit" }) {
  return (
    <Link href={href} target="_blank" rel="noopener noreferrer" className={`${styles.button} ${styles[variant]}`}>
      <DownloadIcon size={14} />
      {label}
    </Link>
  );
}

PressKitButton.propTypes = {
  /** Endereço do press kit — sempre `/…/<slug>/press-kit`. */
  href: PropTypes.string.isRequired,
  variant: PropTypes.oneOf(["outline", "solid"]),
  label: PropTypes.string,
};
