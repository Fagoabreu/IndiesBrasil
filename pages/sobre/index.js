import Link from "next/link";
import { ArrowRightIcon, BookIcon, MilestoneIcon } from "@primer/octicons-react";

import PageHeader from "@/components/PageHeader";
import SeoHead from "@/components/SeoHead";

import { ABOUT_DOCS } from "@/lib/aboutDocs";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

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
        description="Documentos de referência da plataforma: funcionalidades e roadmap."
        canonical={`${SITE_URL}/sobre`}
        noIndex
      />

      <PageHeader eyebrow="Sobre" title="Documentos" subtitle="Referência do projeto: o que a plataforma faz hoje e para onde vai." />

      <ul className={styles.list}>
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
