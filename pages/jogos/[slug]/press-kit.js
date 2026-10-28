import ProductPressKitPage from "@/components/PressKit/ProductPressKitPage";

/**
 * Press kit do jogo — documento focado no produto.
 *
 * Mesmo gate da página de detalhe e da rota de API (`read:game`), porque
 * `getServerSideProps` não passa pelo middleware. Negado vira 404, não 403: o
 * projeto não confirma a existência do que o visitante não pode ver.
 */
export async function getServerSideProps(context) {
  const { slug } = context.params;

  const { anonymousCan } = await import("@/infra/controller");
  if (!anonymousCan("read:game")) return { notFound: true };

  const { loadProductPressKit } = await import("@/lib/pressKitLoader");
  const data = await loadProductPressKit("game", slug);
  if (!data) return { notFound: true };

  return { props: { data } };
}

export default function GamePressKitPage({ data }) {
  return <ProductPressKitPage data={data} />;
}

// Documento para imprimir: não entra o cabeçalho nem a barra lateral do site.
GamePressKitPage.noLayout = true;
