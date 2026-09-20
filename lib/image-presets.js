/**
 * Catálogo único de recortes de imagem da aplicação.
 *
 * Cada preset descreve o formato com que a imagem é **exibida**, não um número
 * arbitrário: o crop e o CSS que renderiza a imagem precisam concordar, senão o
 * usuário enquadra uma coisa e recebe outra. Os comentários de cada item citam
 * onde a imagem aparece, para dar para conferir a proporção no CSS.
 *
 * `outputWidth` define a largura final do arquivo gerado (a altura sai da
 * proporção). Sem ele o `generateImage` só limitava a maior dimensão, então um
 * avatar de 128px era salvo como PNG de até 1600px.
 */

/** Proporções que aparecem em mais de um preset. */
const LANDSCAPE = 16 / 9;
// Alturas fixas de banner (o CSS limita a altura e a largura acompanha):
// perfil — .imageWrapper (perfil.module.css) 150px sobre 752px de conteúdo;
// estúdio — mesmo esquema, 150px sobre 968px;
// evento — hero do evento, 150px sobre 866px (agenda/[id]/index.module.css).
const PROFILE_BANNER = 752 / 150;
const STUDIO_BANNER = 968 / 150;
const EVENT_BANNER = 866 / 150;

export const IMAGE_PRESETS = {
  // ── Pessoas e organizações ──
  avatar: {
    aspect: 1,
    shape: 100, // circular
    label: "Avatar",
    outputWidth: 512,
    // PNG: o recorte circular deixa os cantos transparentes.
    format: "image/png",
    // .avatarContainer (perfil.module.css) 134x134 circular
  },
  profileBanner: {
    aspect: PROFILE_BANNER,
    shape: 0,
    label: "Capa do perfil",
    outputWidth: 1504,
    format: "image/jpeg",
  },
  studioLogo: {
    aspect: 1,
    shape: 0, // quadrado com cantos arredondados pelo CSS (.logoWrapper, raio 10px)
    label: "Logo do estúdio",
    outputWidth: 512,
    // PNG: logotipo costuma vir com fundo transparente.
    format: "image/png",
  },
  studioBanner: {
    aspect: STUDIO_BANNER,
    shape: 0,
    label: "Banner do estúdio",
    outputWidth: 1936,
    format: "image/jpeg",
  },

  // ── Obras ──
  // Jogos e jogos de mesa: os cards usam 16/9 (GameCard/BoardGameCard.module.css).
  // O preset antigo era 460/215 (capsule da Steam), que não batia com o render.
  mediaCover: {
    aspect: LANDSCAPE,
    shape: 0,
    label: "Capa da obra",
    outputWidth: 1600,
    format: "image/jpeg",
  },
  // Livros e quadrinhos são capa retrato (BookCard.module.css, 2/3).
  bookCover: {
    aspect: 2 / 3,
    shape: 0,
    label: "Capa de livro",
    outputWidth: 800,
    format: "image/jpeg",
  },

  // ── Loja ──
  product: {
    aspect: 16 / 10,
    shape: 0,
    label: "Imagem do produto",
    outputWidth: 1600,
    format: "image/jpeg",
  },

  // ── Eventos ──
  eventBanner: {
    aspect: EVENT_BANNER,
    shape: 0,
    label: "Capa do evento",
    outputWidth: 1732,
    format: "image/jpeg",
  },

  // ── Conteúdo editorial ──
  post: {
    aspect: 4 / 3,
    shape: 0,
    label: "Imagem da postagem",
    outputWidth: 1600,
    format: "image/jpeg",
  },
  newsCover: {
    aspect: LANDSCAPE, // NewsCard.module.css
    shape: 0,
    label: "Imagem da notícia",
    outputWidth: 1600,
    format: "image/jpeg",
  },
  // Análises e cursos: capa larga de cabeçalho de página.
  landscapeCover: {
    aspect: LANDSCAPE,
    shape: 0,
    label: "Capa",
    outputWidth: 1600,
    format: "image/jpeg",
  },
};

export const DEFAULT_PRESET = "avatar";

/**
 * Resolve um preset pelo nome.
 *
 * Lança em nome desconhecido de propósito: cair num padrão silencioso
 * esconderia um `preset` digitado errado, e o usuário receberia um recorte
 * diferente do esperado sem nenhum aviso — exatamente o tipo de divergência
 * silenciosa que este catálogo existe para impedir. Todos os usos são literais,
 * então um erro aqui é sempre engano de código, e não dado de entrada.
 */
export function getImagePreset(name) {
  const preset = IMAGE_PRESETS[name];
  if (!preset) {
    throw new Error(`Preset de imagem desconhecido: "${name}". Disponíveis: ${IMAGE_PRESET_NAMES.join(", ")}.`);
  }
  return preset;
}

/** Lista de nomes — usada nas `propTypes` de quem recebe o preset por prop. */
export const IMAGE_PRESET_NAMES = Object.keys(IMAGE_PRESETS);
