import { SITE_URL } from "@/lib/seo";

export async function getServerSideProps({ res }) {
  const body = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/

Sitemap: ${SITE_URL}/sitemap.xml
`;

  res.setHeader("Content-Type", "text/plain; charset=UTF-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(body);
  res.end();
  return { props: {} };
}

export default function Robots() {
  return null;
}
