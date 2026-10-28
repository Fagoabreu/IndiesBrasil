import {
  STAGE_LABELS,
  BOOK_STAGE_LABELS,
  GAME_PLATFORM_LABELS,
  BOOK_TYPE_LABELS,
  formatReleaseDate,
  videoEmbed,
  studioContext,
  buildGamePressKit,
  buildBoardgamePressKit,
  buildBookPressKit,
} from "@/lib/productPressKit";

/**
 * O press kit do produto é montado por um módulo puro: o formato (factsheet,
 * níveis de descrição, mídia, equipe) não depende do banco. Estes testes rodam
 * sobre as mesmas linhas que os models devolvem e fixam as regras que a tela não
 * deve reimplementar.
 */

function gameRow(overrides = {}) {
  return {
    id: "game-1",
    slug: "jogo-exemplo",
    name: "Jogo Exemplo",
    short_description: "Um platformer sobre café.",
    description: null,
    release_date: "2026-10-12T00:00:00.000Z",
    genre: "Plataforma",
    engine: "Godot",
    stage: "released",
    website_url: "https://exemplo.dev/jogo",
    trailer_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    cover_url: "https://res.cloudinary.com/x/cover.jpg",
    banner_url: "https://res.cloudinary.com/x/banner.jpg",
    owner_org_id: "org-1",
    studio_name: "Estúdio Exemplo",
    studio_slug: "estudio-exemplo",
    owner_username: "autora",
    platforms: ["windows", "switch"],
    tags: [
      { id: 1, name: "Pixels" },
      { id: 2, name: "Café" },
    ],
    media: [
      { id: 1, media_type: "video", url: "https://www.youtube.com/watch?v=aaaaaaaaaaa", caption: "Gameplay" },
      { id: 2, media_type: "image", url: "https://res.cloudinary.com/x/shot1.jpg", caption: "Fase 1" },
    ],
    team: [{ id: 9, username: "autora", display_name: "Ana", roles: "Programação", avatar_url: null }],
    store_pages: [
      { id: 1, store_name: "Steam", page_url: "https://store.steampowered.com/app/1", price: "29.90" },
      { id: 2, store_name: "itch.io", page_url: "https://exemplo.itch.io/jogo", price: "39.90" },
    ],
    ...overrides,
  };
}

const studioFixture = {
  studio: {
    id: "org-1",
    slug: "estudio-exemplo",
    name: "Estúdio Exemplo",
    pitch: "Fazemos jogos pequenos.",
    history: "Nasceu numa garagem.",
    logo_url: "https://res.cloudinary.com/x/logo.png",
    banner_url: null,
    website: "https://exemplo.dev",
    founded_at: "2019-03-01T00:00:00.000Z",
    city: "São Paulo",
    state: "SP",
  },
  members: [{ id: "u1", username: "autora", display_name: "Ana", roles: ["admin"], avatar_url: null, bio: "Programadora" }],
  contacts: [
    {
      id: 1,
      icon_key: "youtube",
      contact_value: "https://www.youtube.com/@exemplo",
      url: "https://www.youtube.com/@exemplo",
      display: "@exemplo",
      label: "YouTube",
    },
    {
      id: 2,
      icon_key: "email",
      contact_value: "imprensa@exemplo.dev",
      url: "mailto:imprensa@exemplo.dev",
      display: "imprensa@exemplo.dev",
      label: "E-mail",
    },
  ],
};

describe("Rótulos do press kit de produto", () => {
  test("O mesmo stage tem rótulo próprio em livro/quadrinho", () => {
    expect(STAGE_LABELS.released).toBe("Lançado");
    expect(BOOK_STAGE_LABELS.released).toBe("Publicado");
    // O resto é compartilhado: uma cópia por tipo divergiria no primeiro ajuste.
    expect(BOOK_STAGE_LABELS.concept).toBe(STAGE_LABELS.concept);
  });

  test("Plataformas e tipos de publicação têm rótulo legível", () => {
    expect(GAME_PLATFORM_LABELS.xbox_series).toBe("Xbox Series X|S");
    expect(BOOK_TYPE_LABELS.comic).toBe("Quadrinho");
  });
});

describe("formatReleaseDate", () => {
  test("Data DATE é formatada no dia civil de UTC — não no fuso do servidor", () => {
    // `new Date("2026-10-12")` é meia-noite UTC. Formatar sem `timeZone` no
    // servidor (BRT, UTC-3) devolveria 11 de outubro.
    expect(formatReleaseDate("2026-10-12T00:00:00.000Z")).toBe("12 de outubro de 2026");
    expect(formatReleaseDate(new Date("2026-01-01T00:00:00.000Z"))).toBe("01 de janeiro de 2026");
  });

  test("Sem data (ou data inválida) devolve null, não a linha vazia", () => {
    expect(formatReleaseDate(null)).toBeNull();
    expect(formatReleaseDate("")).toBeNull();
    expect(formatReleaseDate("não é data")).toBeNull();
  });
});

describe("videoEmbed", () => {
  test("Reconhece YouTube nas formas que o app compartilha", () => {
    expect(videoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ").src).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(videoEmbed("https://youtu.be/dQw4w9WgXcQ").id).toBe("dQw4w9WgXcQ");
    expect(videoEmbed("https://www.youtube.com/live/dQw4w9WgXcQ").provider).toBe("youtube");
  });

  test("Reconhece Vimeo e ignora o resto", () => {
    expect(videoEmbed("https://vimeo.com/123456789").src).toBe("https://player.vimeo.com/video/123456789");
    expect(videoEmbed("https://exemplo.dev/trailer.mp4")).toBeNull();
    expect(videoEmbed(null)).toBeNull();
  });
});

describe("buildGamePressKit", () => {
  test("Factsheet traz os dados técnicos, sem plataforma em inglês", () => {
    const kit = buildGamePressKit(gameRow(), studioContext(studioFixture));
    const fact = Object.fromEntries(kit.factsheet.map((row) => [row.label, row.value]));

    expect(fact.Desenvolvedor).toBe("Estúdio Exemplo");
    expect(fact["Lançamento"]).toBe("12 de outubro de 2026");
    expect(fact.Plataformas).toBe("Windows, Nintendo Switch");
    expect(fact.Engine).toBe("Godot");
    expect(fact["Situação"]).toBe("Lançado");
  });

  test("Preço com valores diferentes vira 'A partir de' do menor", () => {
    const kit = buildGamePressKit(gameRow(), studioContext(studioFixture));
    const price = kit.factsheet.find((row) => row.label === "Preço");

    expect(price.value).toContain("A partir de");
    expect(price.value).toContain("29,90");
  });

  test("Preço único é o próprio valor; sem lojas, a linha não existe", () => {
    const one = buildGamePressKit(gameRow({ store_pages: [{ id: 1, store_name: "Steam", page_url: "https://loja/1", price: "10.00" }] }), null);
    expect(one.factsheet.find((row) => row.label === "Preço").value).toContain("10,00");

    const none = buildGamePressKit(gameRow({ store_pages: [] }), null);
    expect(none.factsheet.some((row) => row.label === "Preço")).toBe(false);
  });

  test("Nenhum campo do factsheet vem vazio", () => {
    const kit = buildGamePressKit(
      gameRow({ engine: null, release_date: null, genre: "Indefinido", website_url: null, tags: [], platforms: [] }),
      null,
    );

    for (const row of kit.factsheet) {
      expect(typeof row.value).toBe("string");
      expect(row.value.trim()).not.toBe("");
    }
    expect(kit.factsheet.some((row) => row.label === "Engine")).toBe(false);
    expect(kit.factsheet.some((row) => row.label === "Gênero")).toBe(false);
  });

  test("Descrição com um parágrafo só não aparece duas vezes", () => {
    const kit = buildGamePressKit(gameRow({ short_description: "Só um resumo.", description: "Só um resumo." }), null);

    expect(kit.description.tagline).toBe("Só um resumo.");
    expect(kit.description.pitch).toBeNull();
    expect(kit.description.about).toBeNull();
  });

  test("Descrição longa sem resumo: o primeiro parágrafo vira a frase de efeito", () => {
    const kit = buildGamePressKit(gameRow({ short_description: null, description: "Primeiro parágrafo.\n\nSegundo parágrafo." }), null);

    expect(kit.description.tagline).toBe("Primeiro parágrafo.");
    // O lead já mostra esse parágrafo: repeti-lo no pitch seria duplicação.
    expect(kit.description.pitch).toBeNull();
    expect(kit.description.about).toBe("Primeiro parágrafo.\n\nSegundo parágrafo.");
  });

  test("Com resumo curto, o primeiro parágrafo vira o pitch", () => {
    const kit = buildGamePressKit(
      gameRow({ short_description: "Plataformer de café.", description: "Primeiro parágrafo.\n\nSegundo parágrafo." }),
      null,
    );

    expect(kit.description.tagline).toBe("Plataformer de café.");
    expect(kit.description.pitch).toBe("Primeiro parágrafo.");
    expect(kit.description.about).toBe("Primeiro parágrafo.\n\nSegundo parágrafo.");
  });

  test("Mídia separa imagens de vídeos e o trailer vem primeiro", () => {
    const kit = buildGamePressKit(gameRow(), null);

    expect(kit.images.map((image) => image.caption)).toEqual(["Fase 1"]);
    expect(kit.videos[0].caption).toBe("Trailer");
    expect(kit.videos[1].caption).toBe("Gameplay");
  });

  test("Key art, capa e logo do estúdio alimentam o bloco de assets", () => {
    // `assets` usa `url`/`label`; passar pelo filtro de factsheet (que olha
    // `value`) apagava a lista inteira e o documento saía sem imagem nenhuma.
    const kit = buildGamePressKit(gameRow(), studioContext(studioFixture));

    expect(kit.assets.map((asset) => asset.label)).toEqual(["Key art", "Capa", "Logo do estúdio"]);
    expect(kit.assets[0].url).toBe("https://res.cloudinary.com/x/banner.jpg");
  });

  test("Contato de imprensa prefere e-mail, mesmo com redes sociais cadastradas", () => {
    const kit = buildGamePressKit(gameRow(), studioContext(studioFixture));

    expect(kit.pressContact.label).toBe("E-mail");
    expect(kit.pressContact.href).toBe("mailto:imprensa@exemplo.dev");
  });

  test("Produto sem estúdio usa o dono como desenvolvedor e não inventa contato", () => {
    const kit = buildGamePressKit(gameRow({ studio_slug: null, studio_name: null, studio_logo_url: null }), null);

    expect(kit.developer).toEqual({ name: "autora", url: "/perfil/autora" });
    expect(kit.studio).toBeNull();
    expect(kit.pressContact).toBeNull();
  });
});

describe("buildBoardgamePressKit", () => {
  const row = {
    slug: "mesa-exemplo",
    name: "Mesa Exemplo",
    short_description: "Um jogo de cartas.",
    description: null,
    release_date: null,
    stage: "prototype",
    category: "card_game",
    player_count_min: 2,
    player_count_max: 4,
    play_time_min: 30,
    play_time_max: 45,
    age_rating: 10,
    weight: "2.5",
    website_url: null,
    cover_url: null,
    banner_url: null,
    studio_slug: "estudio-exemplo",
    studio_name: "Estúdio Exemplo",
    mechanics: ["Draft", "Set collection"],
  };

  test("Factsheet traduz faixas de jogadores, duração e peso", () => {
    const kit = buildBoardgamePressKit(row, [], null);
    const fact = Object.fromEntries(kit.factsheet.map((item) => [item.label, item.value]));

    expect(fact.Jogadores).toBe("2–4 jogadores");
    expect(fact.Duração).toBe("30–45 min");
    expect(fact.Categoria).toBe("Cartas");
    expect(fact["Idade mínima"]).toBe("10+");
    expect(fact["Peso (BGG)"]).toBe("2.5 / 5");
  });

  test("Mecânicas viram a lista de destaques, e a mídia vem do segundo argumento", () => {
    const media = [{ id: 3, media_type: "image", url: "https://res.cloudinary.com/x/mesa.jpg", caption: "Componentes" }];
    const kit = buildBoardgamePressKit(row, media, null);

    expect(kit.features).toEqual(["Draft", "Set collection"]);
    expect(kit.images).toHaveLength(1);
  });

  test("Jogo de uma pessoa só usa o singular", () => {
    const kit = buildBoardgamePressKit({ ...row, player_count_min: 1, player_count_max: 1 }, [], null);
    expect(kit.factsheet.find((item) => item.label === "Jogadores").value).toBe("1 jogador");
  });
});

describe("buildBookPressKit", () => {
  const row = {
    slug: "quadrinho-exemplo",
    title: "Quadrinho Exemplo",
    subtitle: "Volume 1",
    short_description: "Uma HQ sobre café.",
    description: null,
    book_type: "comic",
    stage: "released",
    release_date: "2025-06-01T00:00:00.000Z",
    publisher: "Editora Exemplo",
    edition: "1ª",
    pages: 120,
    language: "Português",
    isbn: "978-85-0000-000-0",
    cover_url: "https://res.cloudinary.com/x/hq.jpg",
    website_url: null,
    studio_slug: "estudio-exemplo",
    studio_name: "Estúdio Exemplo",
    store_pages: [{ id: 1, store_name: "Loja", page_url: "https://loja/hq", price: null }],
  };

  test("Tipo e situação usam os rótulos de publicação", () => {
    const kit = buildBookPressKit(row, null);
    const fact = Object.fromEntries(kit.factsheet.map((item) => [item.label, item.value]));

    expect(kit.kind).toBe("book");
    expect(kit.kindLabel).toBe("Quadrinho");
    expect(fact.Tipo).toBe("Quadrinho");
    expect(fact["Situação"]).toBe("Publicado");
    expect(fact.Páginas).toBe("120");
  });

  test("Loja sem preço não inventa valor na tabela", () => {
    const kit = buildBookPressKit(row, null);

    expect(kit.storeLinks).toEqual([{ id: 1, name: "Loja", url: "https://loja/hq", price: null }]);
    expect(kit.factsheet.some((item) => item.label === "Preço")).toBe(false);
  });
});
