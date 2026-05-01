import Head from "next/head";
import PropTypes from "prop-types";
import { SITE_NAME, SITE_LOCALE, DEFAULT_OG_IMAGE, TWITTER_HANDLE } from "@/lib/seo";

/**
 * Componente de SEO reutilizável para todas as páginas.
 * Injeta <title>, <meta>, Open Graph, Twitter Card e JSON-LD via next/head.
 */
export default function SeoHead({ title, description, canonical, ogImage, jsonLd, noIndex }) {
  const image = ogImage || DEFAULT_OG_IMAGE;

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      <meta name="robots" content={noIndex ? "noindex, nofollow" : "index, follow"} />
      <meta httpEquiv="content-language" content="pt-BR" />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:locale" content={SITE_LOCALE} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={TWITTER_HANDLE} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* JSON-LD estruturado (opcional) */}
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
    </Head>
  );
}

SeoHead.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  canonical: PropTypes.string.isRequired,
  ogImage: PropTypes.string,
  jsonLd: PropTypes.object,
  noIndex: PropTypes.bool,
};

SeoHead.defaultProps = {
  ogImage: null,
  jsonLd: null,
  noIndex: false,
};
