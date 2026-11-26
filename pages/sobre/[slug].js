import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { ArrowLeftIcon } from "@primer/octicons-react";

import { PageHeader, PageShell } from "@/components/ui/organisms";
import SeoHead from "@/components/SeoHead";
import mdBody from "@/components/Markdown/markdownBody.module.css";

import { getAboutDoc, aboutDocPaths, resolveDocLinks, stripDocTitle } from "@/lib/aboutDocs";
import { renderMarkdown } from "@/lib/markdown";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

import styles from "./sobre.module.css";

/**
 * Um documento de `docs/` publicado no site.
 *
 * `getStaticProps` (e não `getServerSideProps`): o arquivo é versionado junto com
 * o código, então o HTML não muda entre requests. Isso também resolve o
 * `output: "standalone"` — `fs.readFile` com caminho montado em runtime não é
 * rastreável pelo file tracing do Next, e ler `docs/` a cada request exigiria
 * `outputFileTracingIncludes` para a pasta inteira.
 */
export default function SobreDocPage({ doc, html }) {
  return (
    <PageShell width="content">
      {/* `noIndex`: são documentos de referência do projeto, não páginas de
          entrada. Repetir o inventário interno no índice do Google só criaria
          página concorrendo com as listagens reais. */}
      <SeoHead title={`${doc.title} — ${SITE_NAME}`} description={doc.summary} canonical={`${SITE_URL}/sobre/${doc.slug}`} noIndex />

      <PageHeader
        eyebrow="Sobre"
        title={doc.title}
        subtitle={doc.summary}
        actions={
          <Link href="/sobre" className={styles.indexLink}>
            <ArrowLeftIcon size={14} />
            Todos os documentos
          </Link>
        }
      />

      {/*
       * O HTML vem de `lib/markdown.js`, que aplica `lib/sanitize.js` por último:
       * `<script>`, `<style>`, `<iframe>`, handlers `on*`, `style` inline e URLs
       * `javascript:` não sobrevivem ao filtro. `resolveDocLinks` roda depois e
       * só troca `href` relativo terminando em `.md`. Nenhuma outra string entra
       * aqui.
       */}
      <article className={`${mdBody.md} ${styles.doc}`} dangerouslySetInnerHTML={{ __html: html }} />
    </PageShell>
  );
}

export async function getStaticPaths() {
  return { paths: aboutDocPaths(), fallback: false };
}

export async function getStaticProps({ params }) {
  const doc = getAboutDoc(params.slug);

  // A lista é fechada (`lib/aboutDocs.js`): o slug da URL é **procurado** nela,
  // não concatenado num caminho de arquivo. Sem essa busca, `../../.env` viraria
  // leitura de arquivo arbitrário. `fallback: false` já cobre o caso, mas o
  // guarda aqui evita que alguém leia o código e conclua o contrário.
  if (!doc) return { notFound: true };

  const source = fs.readFileSync(path.join(process.cwd(), "docs", doc.file), "utf8");
  const { html } = renderMarkdown(source, { tableWrapperClass: mdBody.tableWrap });

  // A ordem importa: `stripDocTitle` primeiro, porque o `<h1>` está no começo e
  // `resolveDocLinks` não mexe em tag de título.
  return { props: { doc, html: stripDocTitle(resolveDocLinks(html)) } };
}
