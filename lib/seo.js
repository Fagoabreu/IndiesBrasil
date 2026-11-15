// Centraliza constantes e helpers de SEO para o projeto.
// O domínio é definido via variável de ambiente; ajuste NEXT_PUBLIC_SITE_URL no .env.local.
import { getImagePreset } from "@/lib/image-presets";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://jogos.social.br";
/**
 * Nome da marca — a única fonte do nome exibido em `<title>`, Open Graph,
 * JSON-LD, e-mails e documentos gerados.
 *
 * Lê `NEXT_PUBLIC_SITE_NAME` porque a variável já existia no `.env` e no
 * `deploy.yml` e **nenhum código a consumia**: o valor era decorativo e a marca
 * real morava nesta linha, obrigando a caçar o nome em ~90 arquivos a cada
 * mudança (foi o que aconteceu na migração Indies Brasil → Jogos Social).
 * O fallback é o nome atual, então rodar sem a variável continua correto.
 *
 * É a **definição**: o valor é literal aqui e todos os outros arquivos importam
 * daqui. Qualquer `SITE_NAME` vindo de `import` neste arquivo seria circular.
 */
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "Jogos Social";

/** Domínio de produção — o último recurso quando a configuração não é interpretável. */
const DEFAULT_SITE_HOST = "jogos.social.br";

/**
 * Reduz um endereço ao host — o valor que players de terceiros exigem no
 * parâmetro `parent` (Twitch) e o que o browser expõe em `location.hostname`.
 *
 * Aceita **as duas formas** porque a configuração do projeto usa as duas:
 * `NEXT_PUBLIC_BASE_URL` vale `localhost` (sem esquema) em `.env.development`,
 * e o valor de produção é uma URL completa. `new URL("localhost")` lança
 * `TypeError: Invalid URL` — era assim que qualquer post com link da Twitch
 * respondia 500, porque `resolveTwitch` chamava `new URL` direto na variável.
 *
 * Host puro ganha `https://` só para satisfazer o parser: da URL resultante
 * aproveitamos apenas o `hostname`, sem porta e sem esquema. Devolve `null`
 * quando não há como interpretar o valor — quem chama decide o padrão.
 */
export function normalizeHostname(value) {
  if (value == null) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    return new URL(candidate).hostname || null;
  } catch {
    return null;
  }
}

/**
 * Host público do site, sem porta e sem esquema.
 *
 * `NEXT_PUBLIC_BASE_URL` tem precedência sobre `SITE_URL` porque é a variável
 * que descreve onde o app está **servindo** (deploy.yml a define), enquanto
 * `SITE_URL` é o endereço canônico usado em SEO. O padrão dos dois é o mesmo
 * domínio, então na prática o que muda é só o ambiente local.
 *
 * Nunca devolve `null`: é o valor que vai no `parent` de um iframe, e
 * `parent=null` é embed inválido. Se nem a configuração nem o padrão forem
 * interpretáveis, sobra o domínio de produção.
 */
export function siteHostname() {
  return normalizeHostname(process.env.NEXT_PUBLIC_BASE_URL) || normalizeHostname(SITE_URL) || DEFAULT_SITE_HOST;
}

/**
 * Host de quem está renderizando a página — o que o player da Twitch valida.
 *
 * No navegador é `location.hostname` (o host que o visitante realmente abriu,
 * que pode ser um domínio de preview); no servidor não existe `location` e o
 * valor vem da configuração. Usar o host errado faz a Twitch recusar o embed,
 * e o iframe fica em branco sem erro visível.
 */
export function embedHostname() {
  if (typeof window !== "undefined") {
    const fromBrowser = normalizeHostname(window.location.hostname);
    if (fromBrowser) return fromBrowser;
  }

  return siteHostname();
}

/**
 * Outros nomes pelos quais o site é conhecido.
 *
 * A marca agora é "Jogos Social", que coincide com o endereço `jogos.social.br`
 * — o termo que as pessoas já digitavam e reproduziam ao indicar o site. Antes o
 * nome era "Indies Brasil" e aparecia **só aqui**, enquanto título, Open Graph,
 * H1 e corpo diziam outra coisa: o Google tinha o domínio e a marca como duas
 * coisas separadas, e buscar por "jogos social" não encontrava a página.
 *
 * "Indies Brasil" continua declarado de propósito: é o nome histórico do
 * projeto, e link antigo, matéria publicada e citação em podcast vão usar essa
 * grafia por um bom tempo. O `alternateName` do `WebSite` é o campo que a
 * funcionalidade de **nome do site** do Google consulta.
 *
 * Não inclui `SITE_NAME`: repetir o nome principal como alternativa não ensina
 * nada ao buscador. Este array é só o que é *outro* nome.
 *
 * @see https://schema.org/alternateName
 * @see https://developers.google.com/search/docs/appearance/site-names
 */
export const SITE_ALTERNATE_NAMES = ["Indies Brasil", "jogos.social.br"];
export const SITE_LOCALE = "pt_BR";
/**
 * Arte do site — o MESMO desenho em dois arquivos, porque as superfícies que a
 * mostram têm exigências opostas.
 *
 * `og-cover.jpg` é a capa padrão dos previews de link (`DEFAULT_OG_IMAGE`),
 * usada por toda página que não informa `ogImage` — a home e as listagens
 * (jogos, estúdios, agenda, notícias, membros, loja, streams...). É um arquivo
 * estático, e não uma rota em `pages/api/og/**`, porque não desenha dado de
 * nenhuma entidade: é a marca fixa do site. As redes recortam o preview em
 * 1,91:1, e é por isso que o arquivo já vem nesse formato: a moldura da arte
 * fica centralizada e a sobra escura nas laterais é justamente o que impede o
 * recorte de comer a moldura. Opaco e em JPEG porque preview de link tem limite
 * de tamanho.
 *
 * `og-cover.png` é a mesma arte (mesmo canvas e mesmas medidas) para a home.
 * Lá a sobra lateral não tem função nenhuma e, opaca, aparecia como faixa branca
 * dentro do card — em PNG ela é transparente e o CSS do card (`.promoCard`,
 * `pages/index.module.css`) a descarta, cortando por igual dos dois lados e
 * mostrando a moldura da arte inteira.
 */
export const OG_COVER_IMAGE = "/images/og-cover.jpg";
export const DEFAULT_OG_IMAGE = `${SITE_URL}${OG_COVER_IMAGE}`;
export const OG_COVER_ART = "/images/og-cover.png";
export const TWITTER_HANDLE = "@indiesbrasil";

/**
 * Título de página com a marca no fim: `Agenda — Jogos Social`.
 *
 * O sufixo com o nome do site estava escrito à mão em ~50 arquivos (`"Agenda —
 * Jogos Social"`, `"Eventos — Jogos Social"`…). Além de repetir a marca, nenhum
 * desses títulos era atualizado por um rebrand sem um codemod — e era literal em
 * cada um. Este helper concentra o separador e a marca: trocar o nome é mexer em
 * `SITE_NAME`, não em 50 strings.
 *
 * Devolve só a marca quando não há subtítulo, para não gerar `" — Jogos Social"`.
 *
 * Serve para `<title>`, `og:title` e `twitter:title` — todos os lugares em que o
 * nome do site aparece ao lado do nome da página.
 *
 * @param {string} [subtitle] nome da página ("Agenda", "Análises", "Serviços"…)
 * @returns {string}
 */
export function pageTitle(subtitle) {
  const label = typeof subtitle === "string" ? subtitle.trim() : "";
  if (!label) return SITE_NAME;
  // `Como publicar no Jogos Social` já carrega a marca: acrescentar `— Jogos
  // Social` produzia "Como publicar no Jogos Social — Jogos Social". A
  // duplicação existia antes deste helper (era `PAGE_TITLE — Indies Brasil`
  // com o nome dentro do próprio `PAGE_TITLE`), mas agora é barato evitar.
  if (label.includes(SITE_NAME)) return label;
  return `${label} — ${SITE_NAME}`;
}

/**
 * Medidas do canvas dos dois arquivos da arte do site — e as superfícies que
 * dependem delas.
 *
 * O `SeoHead` publica os dois números em `og:image:width/height`; as redes
 * dimensionam o card **antes** de baixar a imagem, então um número que não bate
 * com o arquivo faz a imagem aparecer esticada ou recortada. A home usa os
 * mesmos números no `<Image>`, que é o que reserva a caixa antes de a imagem
 * carregar — divergir ali aparece como layout shift.
 *
 * A sobra lateral é transparente no PNG e escura no JPEG, mas o canvas é o mesmo
 * nos dois: `scripts/audit-image-presets.js` confere as medidas e a proporção de
 * card contra os arquivos, e confere também o recorte do card da home contra o
 * conteúdo do PNG. Antes apontava para `/images/og-cover.png`, que **não
 * existia** — respondia 404 em produção e todas essas páginas eram
 * compartilhadas sem imagem nenhuma.
 */
export const OG_IMAGE_SIZE = { width: 1424, height: 747 };

/**
 * Medidas dos cards gerados em `/api/og/**` (1.91:1, o recorte de preview).
 *
 * Mora aqui, e **não** em `lib/og-image.js`, por causa de quem consome: as
 * páginas declaram `og:image:width/height` desses cards e são bundle de
 * cliente. Importar `lib/og-image.js` de uma página traz o `sharp` junto e o
 * build quebra com "Can't resolve 'fs'" (aconteceu com a página do evento).
 * `lib/og-image.js` importa daqui para não haver dois números.
 */
export const OG_CARD_SIZE = { width: 1200, height: 630 };

/**
 * Dimensões do arquivo que um preset de imagem gera (largura × altura).
 *
 * As páginas de conteúdo publicam `og:image` apontando para a capa do próprio
 * item — e a capa é o arquivo que o preset de `lib/image-presets.js` produziu
 * (16:9 com 1600px de largura para jogos, jogos de mesa, cursos, análises e
 * notícias; 2:3 com 800px para livros). Antes essas páginas declaravam
 * `1200x630` fixo, número que não corresponde a nenhum arquivo do site: as
 * redes dimensionam o card **antes** de baixar a imagem, então o número errado
 * aparece como imagem esticada ou cortada.
 *
 * O número sai do preset em vez de ser digitado na página para não haver duas
 * fontes — mudar `outputWidth` no preset passa a corrigir o `og:*` junto, e
 * `scripts/audit-image-presets.js` continua sendo quem confere a proporção
 * contra o CSS.
 */
export function ogImageSizeFromPreset(presetName) {
  const { aspect, outputWidth } = getImagePreset(presetName);
  return { width: outputWidth, height: Math.round(outputWidth / aspect) };
}

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

/* =====================
 * Posts
 * ===================== */

/**
 * Texto usado quando o post não tem conteúdo escrito (post só de imagem/embed).
 *
 * Compartilhado com o card de imagem (`pages/api/og/post/[id].js`): o texto que
 * o card desenha e o que os metadados publicam precisam ser o mesmo, senão a
 * prévia do link e a imagem contam coisas diferentes.
 */
export const POST_CONTENT_FALLBACK = `Confira este post no ${SITE_NAME}!`;

/** Limite do título do preview — o WhatsApp corta por volta disso. */
const POST_TITLE_MAX = 100;
/** Limite da descrição do preview. */
const POST_DESCRIPTION_MAX = 200;
/**
 * Quanto a descrição precisa acrescentar além do título para valer a pena.
 * Abaixo disso ela repetiria quase a mesma frase na linha de baixo.
 */
const POST_DESCRIPTION_MIN_EXTRA = 30;

/** Autor do post como `@handle`; vazio quando o dado não existe. */
function postAuthor(post) {
  const username = String(post?.author_username || "").trim();
  return username ? `@${username}` : "";
}

/** Verdadeiro quando o post tem texto próprio (não é só imagem/embed). */
function hasText(post) {
  return Boolean(String(post?.content || "").trim());
}

/**
 * Texto do post, com espaços normalizados.
 *
 * Serve para os metadados e para o card desenharem o mesmo conteúdo.
 */
export function postText(post) {
  const text = String(post?.content || "")
    .replace(/\s+/g, " ")
    .trim();
  return text || POST_CONTENT_FALLBACK;
}

/** Corta o texto no último espaço antes de `max`, sem deixar pontuação solta. */
function truncate(text, max) {
  if (text.length <= max) return text;

  let cut = text.lastIndexOf(" ", max);
  if (cut <= 0) cut = max;

  let head = text.slice(0, cut);
  while (head.length > 0 && " \t,.;:!?…".includes(head.at(-1))) {
    head = head.slice(0, -1);
  }

  return `${head}…`;
}

/** Linha que diz de quem é a publicação, usada como descrição. */
function provenance(post) {
  const author = postAuthor(post);
  return author ? `Por ${author} no ${SITE_NAME}.` : `Na comunidade ${SITE_NAME}.`;
}

/**
 * Título do preview de um post.
 *
 * O título identifica a **publicação**: é o próprio conteúdo do post. Usar
 * `@username` aqui (como era antes) fazia a prévia do link falar do autor em vez
 * do post — e o autor já aparece em destaque na imagem do card
 * (`pages/api/og/post/[id].js`).
 */
export function postMetaTitle(post) {
  if (!hasText(post)) {
    const author = postAuthor(post);
    return author ? `Publicação de ${author}` : `Publicação no ${SITE_NAME}`;
  }

  return truncate(postText(post), POST_TITLE_MAX);
}

/**
 * Descrição do preview de um post.
 *
 * Quando o conteúdo é longo o bastante para render uma segunda linha, a
 * descrição é o trecho do post. Quando ele caberia quase inteiro no título, a
 * descrição só diz de quem é a publicação — repetir a mesma frase nas duas
 * linhas deixa a prévia com texto duplicado.
 */
export function postMetaDescription(post) {
  if (!hasText(post)) return provenance(post);

  const text = postText(post);
  const titulo = truncate(text, POST_TITLE_MAX);
  const trecho = truncate(text, POST_DESCRIPTION_MAX);

  return trecho.length >= titulo.length + POST_DESCRIPTION_MIN_EXTRA ? trecho : provenance(post);
}
