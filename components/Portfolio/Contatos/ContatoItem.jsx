import styles from "./ContatoItem.module.css";
import IconSvg from "@/components/IconSvg/IconSvg";
import PropTypes from "prop-types";

/**
 * Linha de contato — o ponto único de exibição no site.
 *
 * ## O que mudou e por quê
 *
 * Antes esta linha mostrava **a URL crua**: o perfil do Green Tale exibia
 * `https://store.steampowered.com/search/?developer=Green%20Tale%20Studios` em
 * três linhas, quebradas no meio da palavra por um `word-break: break-all`. Quem
 * lê não reconhece aquele texto como "Steam", e a quebra o deixa ainda mais
 * difícil.
 *
 * Agora o registro (`lib/contactTypes.js`) resolve cada valor em um **handle**
 * legível — `@GreentaleStudios`, `greentale.itch.io`, `(11) 99999-9999` — e é
 * ele que aparece. A URL completa continua no `title` e no `href`.
 *
 * ## Por que o rótulo não é um tooltip estilizado
 *
 * Os painéis que hospedam esta linha (`SectionPanel`, `ListableSectionPanel`)
 * têm `overflow: hidden`. Um balão posicionado fora da linha seria **cortado** —
 * então o rótulo usa o `title` nativo, que o navegador desenha fora do contexto
 * de recorte. Onde não existe hover (toque), o rótulo é exibido como legenda
 * fixa: sem mouse, informação que só aparece no hover é informação perdida.
 *
 * @param {{ item: object }} props
 */
export default function ContatoItem({ item }) {
  const value = item?.contact_value ?? "";
  const label = item?.label || item?.icon_key || "Contato";
  // Sem handle, o próprio valor é a informação útil (e-mail, site) — trocá-lo
  // por nada esconderia o dado.
  const text = item?.display || value;
  const url = item?.url ?? null;

  const content = (
    <>
      <IconSvg src={`/images/contacts/${item?.icon_img}.svg`} alt="" fallback />
      <span className={styles.body}>
        <span className={styles.value}>{text}</span>
        <span className={styles.label}>{label}</span>
      </span>
    </>
  );

  // Contato sem URL utilizável (um @usuario do Discord, por exemplo) vira texto
  // simples — antes o press kit montava `href="@usuario"`, que é um link
  // relativo apontando para dentro do próprio site.
  if (!url) {
    return (
      <div className={styles.item} title={label}>
        {content}
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.item} ${styles.link}`}
      title={`${label} — ${value}`}
      // O nome acessível passa a ser "YouTube: @canal" em vez da URL crua.
      aria-label={`${label}: ${text}`}
    >
      {content}
    </a>
  );
}

ContatoItem.propTypes = {
  /** Contato já enriquecido por `serializeContact` (ver `lib/contactTypes.js`). */
  item: PropTypes.shape({
    contact_value: PropTypes.string,
    icon_img: PropTypes.string,
    icon_key: PropTypes.string,
    label: PropTypes.string,
    display: PropTypes.string,
    url: PropTypes.string,
  }).isRequired,
};
