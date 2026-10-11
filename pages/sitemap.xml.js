import { buildSitemapIndex, sendSitemapXml, sitemapKeys } from "@/lib/sitemap";

/**
 * Índice do sitemap: aponta para um arquivo por tipo de conteúdo.
 *
 * A lista de tipos vive em `lib/sitemap.js`. Antes as rotas do sitemap eram
 * literais neste arquivo, e foi assim que ele ficou só com as nove páginas
 * fixas enquanto estúdios, jogos, quadrinhos, cursos, notícias e análises
 * existiam sem nenhum endereço publicado.
 */
export async function getServerSideProps({ res }) {
  sendSitemapXml(res, buildSitemapIndex(sitemapKeys()));
  return { props: {} };
}

// Componente vazio — a resposta é enviada inteiramente pelo getServerSideProps.
export default function SitemapIndex() {
  return null;
}
