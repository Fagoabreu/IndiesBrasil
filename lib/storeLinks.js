/**
 * Reconhecimento de links de lojas que **não** têm widget para incorporar.
 *
 * Fica em `lib/` pelo mesmo motivo de `lib/embedLinks.js`: é análise de URL, sem
 * rede, e a regra precisa ser uma só. Usado pela ficha do jogo
 * (`pages/jogos/[slug]/index.js`) e pelo card que desenha a loja
 * (`components/StoreLinks/GooglePlayCard.jsx`).
 *
 * O Google Play não oferece embed público — a página da loja é servida com
 * cabeçalho anti-framing, então o padrão do Steam (`store.steampowered.com/widget/<id>`)
 * e do itch.io (`itch.io/embed/<id>`) não se aplica. O que dá para derivar com
 * segurança é o identificador do pacote, que é o que este módulo extrai.
 */

const GOOGLE_PLAY_HOST = "play.google.com";

/**
 * Nome de pacote Android: pelo menos dois segmentos (`com.empresa.jogo`).
 *
 * O mínimo de dois segmentos não é preciosismo: `?id=abc` viraria URL de saída
 * para uma página da Play que não existe, e o card prometeria um app que não é o
 * do jogo.
 */
const PACKAGE_ID = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/;

function parse(url) {
  try {
    return new URL(String(url));
  } catch {
    return null;
  }
}

/** Host sem `www.`, para comparar sem depender da forma digitada. */
function hostOf(parsed) {
  return parsed.hostname.toLowerCase().replace(/^www\./, "");
}

/**
 * Id do pacote (`com.empresa.jogo`) do link da Play Store, ou `null`.
 *
 * Devolve `null` para busca, categoria e qualquer endereço que não seja a ficha
 * de um app: só a ficha tem destinos estáveis para abrir.
 */
export function googlePlayPackageId(url) {
  const parsed = parse(url);

  if (!parsed) return null;
  if (hostOf(parsed) !== GOOGLE_PLAY_HOST) return null;

  const id = parsed.searchParams.get("id");

  return id && PACKAGE_ID.test(id) ? id : null;
}

/**
 * Link canônico da ficha do app, ou `null`.
 *
 * O `page_url` cadastrado costuma vir do botão de compartilhar do celular, com
 * `&hl=`, `&gl=` e marcadores de campanha. Descartar isso evita que o card abra
 * uma ficha em outro idioma e mantém o destino igual para todo mundo.
 */
export function googlePlayUrl(url) {
  const id = googlePlayPackageId(url);

  return id ? `https://${GOOGLE_PLAY_HOST}/store/apps/details?id=${id}` : null;
}

/**
 * Título do app a partir do `og:title` da ficha da Play.
 *
 * A loja põe o sufixo dela no título ("Minecraft – Apps no Google Play"). O card
 * já mostra "Google Play" no cabeçalho, então o sufixo só repetiria a informação
 * e empurraria o nome do app para o corte por `ellipsis`.
 */
export function storeAppTitle(title) {
  if (!title) return null;

  return String(title)
    .replace(/\s+[–-]\s+Apps (?:on|no) Google Play.*$/i, "")
    .trim();
}

/**
 * Rótulo da chamada para a loja.
 *
 * "Visitar loja" serve para qualquer loja e não diz nada — quem lê precisa
 * adivinhar o destino de um card sem widget (Google Play, App Store, Epic, GOG,
 * Xbox, PlayStation). As lojas com widget não usam este rótulo.
 */
export function storeCtaLabel(storeName) {
  const key = String(storeName ?? "")
    .trim()
    .toLowerCase();

  if (key === "google play") return "Ver no Google Play";
  if (key === "app store") return "Ver na App Store";
  if (key === "steam") return "Ver na Steam";
  if (key === "itch.io") return "Ver na itch.io";
  if (key === "epic games store") return "Ver na Epic Games Store";
  if (key === "gog") return "Ver na GOG";
  if (key === "xbox") return "Ver na Xbox";
  if (key === "playstation") return "Ver na PlayStation";

  return "Visitar loja";
}
