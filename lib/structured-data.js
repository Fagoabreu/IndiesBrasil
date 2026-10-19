/**
 * Dados estruturados (JSON-LD) das páginas de conteúdo.
 *
 * ## Por que aqui e não em cada página
 *
 * O `SeoHead` desmonta o JSON-LD com `JSON.stringify` + escape anti-XSS
 * (`components/SeoHead.js`). Ele já esperava um objeto pronto — o que faltava
 * era quem o montasse. A página do estúdio montava o `Organization` inline, e
 * repetir esse bloco em sete páginas faria cada uma divergir no primeiro ajuste
 * (foi assim que a página de editar evento passou a usar uma classe de CSS que
 * só existia na página de criar).
 *
 * ## Regra que todos os builders seguem
 *
 * Não emitem chave sem valor. Uma propriedade presente e vazia (`"rating": null`,
 * `"image": ""`) é pior que a ausência: o validador do Google marca como erro
 * e o item inteiro perde o rich result, enquanto a propriedade ausente é apenas
 * ausente. É o papel de {@link compact}.
 */

import { SITE_URL } from "@/lib/seo";

/** Remove chaves cujo valor é `undefined`, `null`, `""` ou array vazio. */
function compact(object) {
  /** @type {Record<string, unknown>} */
  const result = {};

  for (const [key, value] of Object.entries(object)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    result[key] = value;
  }

  return result;
}

/**
 * `BreadcrumbList` a partir da trilha da página.
 *
 * A trilha é a mesma que já aparece na tela (o `<nav>` com `Jogos / Nome`):
 * declarar aqui só o que o usuário vê evita a divergência clássica de anunciar
 * uma hierarquia que a página não mostra.
 *
 * @param {{ name: string, path: string }[]} trail — `path` é relativo ao site
 */
export function breadcrumbList(trail) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

/** `VideoGame` — página do jogo. */
export function videoGame({ name, description, image, url, studioName, studioUrl, genre, platforms, releaseDate, rating, ratingCount }) {
  return compact({
    "@type": "VideoGame",
    name,
    description,
    image,
    url,
    genre: genre && genre !== "Indefinido" ? genre : null,
    gamePlatform: platforms?.length ? platforms : null,
    datePublished: releaseDate || null,
    ...(studioName
      ? {
          publisher: compact({ "@type": "Organization", name: studioName, url: studioUrl || null }),
        }
      : {}),
    ...aggregateRating(rating, ratingCount),
  });
}

/** `Game` — página do jogo de mesa (tabuleiro, cartas, RPG de mesa). */
export function boardGame({
  name,
  description,
  image,
  url,
  category,
  studioName,
  studioUrl,
  minPlayers,
  maxPlayers,
  releaseDate,
  rating,
  ratingCount,
}) {
  return compact({
    "@type": "Game",
    name,
    description,
    image,
    url,
    genre: category || null,
    numberOfPlayers: playerCount(minPlayers, maxPlayers),
    datePublished: releaseDate || null,
    ...(studioName
      ? {
          publisher: compact({ "@type": "Organization", name: studioName, url: studioUrl || null }),
        }
      : {}),
    ...aggregateRating(rating, ratingCount),
  });
}

/** `Book` — página de quadrinho, mangá, zine ou livro. */
export function book({ title, subtitle, description, image, url, isbn, publisher, pages, language, releaseDate, rating, ratingCount }) {
  return compact({
    "@type": "Book",
    name: title,
    alternativeHeadline: subtitle || null,
    description,
    image,
    url,
    isbn: isbn || null,
    publisher: publisher || null,
    numberOfPages: pages || null,
    inLanguage: languageCode(language),
    datePublished: releaseDate || null,
    ...aggregateRating(rating, ratingCount),
  });
}

/**
 * `inLanguage` só aceita etiqueta de idioma (BCP 47: `pt`, `pt-BR`).
 *
 * O campo `books.language` do banco tem o padrão `'Português'` **com as aspas**
 * dentro do valor (`DEFAULT '''Português'''` na migration), e a tela o exibe
 * assim mesmo — é o dado que está errado, e corrigi-lo é uma migration. Fica
 * fora do JSON-LD enquanto não for uma etiqueta válida: publicar
 * `"inLanguage": "'Português'"` gera aviso no validador do Google, e campo
 * opcional com valor inválido é pior que campo ausente.
 */
function languageCode(value) {
  const tag = String(value || "").trim();
  return /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(tag) ? tag : null;
}

/**
 * `CreativeWork` — página do asset.
 *
 * Asset é conteúdo criativo referenciado externamente (pacote de sprites,
 * trilha, plugin…), e `CreativeWork` é o tipo que descreve "obra" sem forçar um
 * formato que não existe: `VideoGame`, `Book` e `Game` são páginas de obra
 * própria e não servem para um pacote de SFX.
 *
 * `license` só entra quando a licença tem URL — `"proprietary"` não tem, e uma
 * licença sem endereço não é um dado utilizável pelo consumidor.
 */
export function creativeWork({ name, description, image, url, creatorName, creatorUrl, keywords, license, genre }) {
  return compact({
    "@type": "CreativeWork",
    name,
    description,
    image,
    url,
    genre: genre || null,
    keywords: keywords?.length ? keywords.join(", ") : null,
    license: license || null,
    ...(creatorName
      ? {
          creator: compact({ "@type": "Organization", name: creatorName, url: creatorUrl || null }),
        }
      : {}),
  });
}

/** `NewsArticle` — página da notícia. */
export function newsArticle({ headline, description, image, url, authorName, datePublished, dateModified }) {
  return compact({
    "@type": "NewsArticle",
    headline,
    description,
    image,
    url,
    datePublished: datePublished || null,
    dateModified: dateModified || null,
    author: authorName ? { "@type": "Person", name: authorName } : null,
  });
}

/**
 * `Review` — página da análise.
 *
 * `itemReviewed` é o que faz a análise valer como rich result: sem dizer **o
 * que** foi avaliado, o item é incompleto. O tipo do alvo muda (`VideoGame`,
 * `Game`, `Book`), por isso entra por parâmetro em vez de ser fixo.
 */
export function review({ title, body, url, image, rating, authorName, datePublished, itemReviewed, contentUrl }) {
  return compact({
    "@type": "Review",
    name: title,
    reviewBody: body || null,
    url,
    image,
    datePublished: datePublished || null,
    author: authorName ? { "@type": "Person", name: authorName } : null,
    ...(rating ? { reviewRating: { "@type": "Rating", ratingValue: rating, bestRating: 5 } } : {}),
    itemReviewed: compact({ ...itemReviewed, url: contentUrl || null }),
  });
}

/** `Course` — página do curso. */
export function course({ name, description, image, url, providerName, lessonCount, rating, ratingCount }) {
  return compact({
    "@type": "Course",
    name,
    description,
    image,
    url,
    provider: providerName ? compact({ "@type": "Organization", name: providerName }) : null,
    numberOfCredits: lessonCount || null,
    ...aggregateRating(rating, ratingCount),
  });
}

/**
 * `Event` — página do evento na agenda.
 *
 * `startDate` é a única propriedade **obrigatória** do tipo: sem ela o Google
 * descarta o item, então um evento sem data não gera JSON-LD nenhum (ver
 * `graph`, que descarta itens nulos).
 *
 * `eventAttendanceMode` não é decorativo: o mesmo evento presencial e online
 * (`is_online` com endereço) é `MixedEventAttendanceMode` e aceita **dois**
 * `location` — declarar só um deles faz o Google mostrar o evento no lugar
 * errado. `eventStatus` idem: um evento cancelado publicado como
 * `EventScheduled` continua aparecendo como acontecendo.
 *
 * `offers` fica de fora mesmo com `ticket_url`: `Offer` exige o preço, e um
 * `Offer` sem `price` é erro no validador — melhor não ter rich result de
 * ingresso do que ter um inválido.
 */
export function event({
  name,
  description,
  startDate,
  endDate,
  image,
  url,
  status,
  isOnline,
  locationName,
  locationUrl,
  address,
  onlineUrl,
  organizerName,
  organizerUrl,
  organizerType = "Organization",
}) {
  if (!startDate) return null;

  const hasPhysicalLocation = Boolean(locationName || address?.city);
  const attendanceMode = isOnline
    ? hasPhysicalLocation
      ? "https://schema.org/MixedEventAttendanceMode"
      : "https://schema.org/OnlineEventAttendanceMode"
    : "https://schema.org/OfflineEventAttendanceMode";

  const locations = [];

  if (hasPhysicalLocation) {
    locations.push(
      compact({
        "@type": "Place",
        name: locationName || null,
        url: locationUrl || null,
        address: address?.city ? postalAddress(address) : null,
      }),
    );
  }

  // Sem endereço e sem `online_url` não há local a declarar: `VirtualLocation`
  // sem `url` é inválido, e omitir a chave inteira é melhor que emitir uma
  // vazia (ver `compact`).
  if (isOnline && onlineUrl) {
    locations.push({ "@type": "VirtualLocation", url: onlineUrl });
  }

  return compact({
    "@type": "Event",
    name,
    description,
    image,
    url,
    startDate,
    endDate: endDate || null,
    eventStatus: status === "cancelled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    eventAttendanceMode: attendanceMode,
    location: locations.length === 1 ? locations[0] : locations,
    organizer: organizerName
      ? compact({
          "@type": organizerType,
          name: organizerName,
          url: organizerUrl || null,
        })
      : null,
  });
}

/** `PostalAddress` a partir do endereço normalizado do evento/estúdio. */
function postalAddress(address) {
  return compact({
    "@type": "PostalAddress",
    streetAddress: [address.street, address.number].filter(Boolean).join(", ") || null,
    addressLocality: address.city || null,
    addressRegion: address.state || null,
    postalCode: address.zip_code || null,
    addressCountry: address.country || null,
  });
}

/** `aggregateRating` só quando há nota de verdade — nota 0 com 0 avaliações não é dado. */
function aggregateRating(rating, count) {
  const value = Number(rating);
  const reviews = Number(count);

  if (!value || !reviews) return {};

  return {
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: value,
      reviewCount: reviews,
      bestRating: 5,
    },
  };
}

/** `numberOfPlayers` da mesa — `QuantitativeValue`, tanto mínimo quanto faixa. */
function playerCount(minPlayers, maxPlayers) {
  const min = Number(minPlayers);
  const max = Number(maxPlayers);
  if (!min) return null;

  if (!max || max === min) return { "@type": "QuantitativeValue", value: min };

  return { "@type": "QuantitativeValue", minValue: min, maxValue: max };
}

/**
 * Envelopa os itens no `@graph`.
 *
 * Um único `<script type="application/ld+json">` com `@graph` em vez de vários
 * blobs: o Google aceita os dois, mas um grafo só deixa claro que os itens se
 * referem à mesma página.
 */
export function graph(...items) {
  return {
    "@context": "https://schema.org",
    "@graph": items.filter(Boolean),
  };
}
