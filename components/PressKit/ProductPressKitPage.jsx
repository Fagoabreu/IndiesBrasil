import PropTypes from "prop-types";
import SeoHead from "@/components/SeoHead";
import { SITE_URL } from "@/lib/seo";
import ProductPressKit from "./ProductPressKit";

/**
 * Moldura das três páginas de press kit de produto.
 *
 * As páginas (`/jogos/[slug]/press-kit`, `/jogos-de-mesa/[slug]/press-kit`,
 * `/quadrinhos/[slug]/press-kit`) só buscam os dados e delegam aqui. O `SeoHead`
 * fica nesta camada porque as três usam exatamente a mesma regra — e o detalhe
 * que importa é `noIndex`: o documento repete o conteúdo da página do produto, e
 * duas URLs com o mesmo texto disputando o índice é o que o `noindex` evita (o
 * press kit do estúdio segue o mesmo critério).
 */
export default function ProductPressKitPage({ data }) {
  const description = data.tagline ?? `${data.title} — press kit para imprensa.`;

  return (
    <>
      <SeoHead
        title={`Press Kit — ${data.title}`}
        description={description}
        canonical={`${SITE_URL}${data.pressKitUrl}`}
        ogImage={data.assets[0]?.url}
        noIndex
      />
      <ProductPressKit data={data} />
    </>
  );
}

ProductPressKitPage.propTypes = {
  data: PropTypes.object.isRequired,
};
