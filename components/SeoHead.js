import Head from "next/head";
import PropTypes from "prop-types";
import { OG_IMAGE_SIZE, SITE_NAME, SITE_LOCALE, DEFAULT_OG_IMAGE, TWITTER_HANDLE } from "@/lib/seo";

/**
 * Serializa JSON-LD com escape de `<`, `>`, `&` e separadores de linha
 * Unicode (U+2028/U+2029). Sem isso, conteúdo de usuário (ex.: nome ou
 * descrição de um estúdio) contendo `</script>` quebraria o bloco de script
 * e permitiria injeção de JavaScript. Os escapes são válidos em strings JSON.
 */
function toSafeJsonLd(jsonLd) {
  return JSON.stringify(jsonLd)
    .replaceAll("<", String.raw`\u003c`)
    .replaceAll(">", String.raw`\u003e`)
    .replaceAll("&", String.raw`\u0026`)
    .replaceAll("\u2028", String.raw`\u2028`)
    .replaceAll("\u2029", String.raw`\u2029`);
}

/**
 * Componente de SEO reutilizável para todas as páginas.
 * Injeta <title>, <meta>, Open Graph, Twitter Card e JSON-LD via next/head.
 *
 * @param {{ title: string, description: string, canonical: string, ogImage?: string, ogImageWidth?: number, ogImageHeight?: number, ogType?: string, jsonLd?: object, noIndex?: boolean }} props
 */
export default function SeoHead({ title, description, canonical, ogImage, ogImageWidth, ogImageHeight, ogType, jsonLd, noIndex }) {
  const image = ogImage || DEFAULT_OG_IMAGE;
  // O padrão vem de `lib/seo.js` para o número declarado e o arquivo gerado
  // terem uma fonte só (ver `OG_IMAGE_SIZE`).
  const imgWidth = ogImageWidth || OG_IMAGE_SIZE.width;
  const imgHeight = ogImageHeight || OG_IMAGE_SIZE.height;

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      <link rel="icon" href="/images/logo.png" />
      <meta name="robots" content={noIndex ? "noindex, nofollow" : "index, follow"} />
      <meta httpEquiv="content-language" content="pt-BR" />

      {/* Open Graph */}
      <meta property="og:type" content={ogType || "website"} />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content={String(imgWidth)} />
      <meta property="og:image:height" content={String(imgHeight)} />
      <meta property="og:locale" content={SITE_LOCALE} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={TWITTER_HANDLE} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* JSON-LD estruturado (opcional) — serializado com escape anti-XSS */}
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toSafeJsonLd(jsonLd) }} />}
    </Head>
  );
}

SeoHead.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  canonical: PropTypes.string.isRequired,
  ogImage: PropTypes.string,
  ogImageWidth: PropTypes.number,
  ogImageHeight: PropTypes.number,
  ogType: PropTypes.string,
  jsonLd: PropTypes.object,
  noIndex: PropTypes.bool,
};

// Sem `defaultProps`: o React 19 ignora `defaultProps` de componente de função,
// então o bloco que existia aqui não tinha efeito nenhum — os padrões reais são
// os `||` no corpo do componente (acima). Manter os dois era pior que não ter
// nenhum: quem lesse acreditaria que os valores daqui valiam.
