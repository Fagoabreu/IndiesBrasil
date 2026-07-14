// Centraliza constantes e helpers de SEO para o projeto.
// O domínio é definido via variável de ambiente; ajuste NEXT_PUBLIC_SITE_URL no .env.local.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://indiesbrasil.com.br";
export const SITE_NAME = "Indies Brasil";
export const SITE_LOCALE = "pt_BR";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/images/og-cover.png`;
export const TWITTER_HANDLE = "@indiesbrasil";

/**
 * Retorna o objeto de metadados base para uma página.
 * @param {{ title: string, description: string, canonical: string, ogImage?: string }} opts
 */
export function buildMeta({ title, description, canonical, ogImage }) {
  return {
    title,
    description,
    canonical: `${SITE_URL}${canonical}`,
    ogImage: ogImage || DEFAULT_OG_IMAGE,
  };
}
