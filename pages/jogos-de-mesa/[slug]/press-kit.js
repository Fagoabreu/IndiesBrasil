import ProductPressKitPage from "@/components/PressKit/ProductPressKitPage";

/**
 * Press kit do jogo de mesa — documento focado no produto.
 *
 * Mesmo gate da página de detalhe e da rota de API (`read:boardgame`), porque
 * `getServerSideProps` não passa pelo middleware. Negado vira 404, não 403.
 */
export async function getServerSideProps(context) {
  const { slug } = context.params;

  const { anonymousCan } = await import("@/infra/controller");
  if (!anonymousCan("read:boardgame")) return { notFound: true };

  const { loadProductPressKit } = await import("@/lib/pressKitLoader");
  const data = await loadProductPressKit("boardgame", slug);
  if (!data) return { notFound: true };

  return { props: { data } };
}

export default function BoardgamePressKitPage({ data }) {
  return <ProductPressKitPage data={data} />;
}

// Documento para imprimir: não entra o cabeçalho nem a barra lateral do site.
BoardgamePressKitPage.noLayout = true;
