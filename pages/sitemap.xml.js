import { SITE_URL } from "@/lib/seo";

// Páginas estáticas e suas prioridades/frequências de atualização.
const STATIC_ROUTES = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/posts", changefreq: "hourly", priority: "0.9" },
  { path: "/membros", changefreq: "daily", priority: "0.8" },
  { path: "/ferramentas/qrgen", changefreq: "monthly", priority: "0.7" },
  { path: "/ferramentas/imagecrop", changefreq: "monthly", priority: "0.7" },
  { path: "/ferramentas/viewer", changefreq: "monthly", priority: "0.7" },
  { path: "/cadastro", changefreq: "yearly", priority: "0.5" },
  { path: "/login", changefreq: "yearly", priority: "0.4" },
];

function buildSitemap(routes) {
  const now = new Date().toISOString();
  const urls = routes
    .map(
      ({ path, changefreq, priority }) => `
  <url>
    <loc>${SITE_URL}${path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`;
}

export async function getServerSideProps({ res }) {
  const xml = buildSitemap(STATIC_ROUTES);
  res.setHeader("Content-Type", "text/xml; charset=UTF-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(xml);
  res.end();
  return { props: {} };
}

// Componente vazio — a resposta é enviada inteiramente pelo getServerSideProps.
export default function Sitemap() {
  return null;
}
