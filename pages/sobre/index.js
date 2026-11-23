import Link from "next/link";
import { ArrowRightIcon, BookIcon, LightBulbIcon, MilestoneIcon } from "@primer/octicons-react";

import PageHeader from "@/components/PageHeader";
import SeoHead from "@/components/SeoHead";

import { ABOUT_DOCS } from "@/lib/aboutDocs";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { HOW_TO_PUBLISH_PATH } from "@/lib/studioEntry";

import styles from "./sobre.module.css";

/**
 * Índice dos documentos de "Sobre".
 *
 * Existe porque o item do menu leva a algum lugar: um endereço que só funciona
 * com slug (`/sobre/roadmap`) deixa `/sobre` respondendo 404, e quem tira o
 * último segmento da URL para "ver o que mais tem aqui" encontra erro.
 */
export default function SobrePage() {
  return (
    <div className={styles.page}>
      <SeoHead
        title={`Sobre — ${SITE_NAME}`}
        description="Documentos de referência da plataforma: como publicar, funcionalidades e roadmap."
        canonical={`${SITE_URL}/sobre`}
        noIndex
      />

      <PageHeader eyebrow="Sobre" title="Documentos" subtitle="Referência do projeto: como publicar, o que a plataforma faz hoje e para onde vai." />

      <ul className={styles.list}>
        {/* "Como publicar" é página de componente (`pages/sobre/como-publicar/`),
            não um documento de `docs/` — por isso não vem de `ABOUT_DOCS`. Fica
            aqui porque agora vive sob `/sobre`, e o índice precisa listar tudo o
            que existe neste caminho. */}
        <li>
          <Link href={HOW_TO_PUBLISH_PATH} className={styles.card}>
            <span className={styles.cardIcon} aria-hidden="true">
              <LightBulbIcon size={18} />
            </span>
            <span className={styles.cardBody}>
              <span className={styles.cardTitle}>Como publicar</span>
              <span className={styles.cardSummary}>
                O caminho para publicar um jogo, jogo de mesa, livro ou asset: criar o estúdio, convidar a equipe e publicar.
              </span>
            </span>
            <ArrowRightIcon size={14} className={styles.cardArrow} />
          </Link>
        </li>

        {ABOUT_DOCS.map((doc) => (
          <li key={doc.slug}>
            <Link href={`/sobre/${doc.slug}`} className={styles.card}>
              <span className={styles.cardIcon} aria-hidden="true">
                {doc.slug === "roadmap" ? <MilestoneIcon size={18} /> : <BookIcon size={18} />}
              </span>
              <span className={styles.cardBody}>
                <span className={styles.cardTitle}>{doc.title}</span>
                <span className={styles.cardSummary}>{doc.summary}</span>
              </span>
              <ArrowRightIcon size={14} className={styles.cardArrow} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
