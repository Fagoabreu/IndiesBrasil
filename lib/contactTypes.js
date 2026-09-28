/**
 * lib/contactTypes.js — Registro central dos tipos de contato.
 *
 * ## Por que existe
 *
 * O contato é gravado como texto livre em `contact_value` (ver
 * `infra/migrations/1754361140791_database_enums.js`), e nenhuma camada sabia
 * **o que** aquele texto era. Isso produzia três sintomas:
 *
 *  1. a URL crua era o rótulo — o visitante lia
 *     `https://store.steampowered.com/search/?developer=Green%20Tale` em vez de
 *     "Jogos de Green Tale Studios";
 *  2. texto livre aceitava qualquer coisa, incluindo número de telefone sem
 *     formato e @usuario que não vira link;
 *  3. cada uma das seis telas que exibem contato (perfil, estúdio, press kit,
 *     currículo, configurações de perfil e do estúdio) decidia sozinha como
 *     mostrar — e divergiam (o press kit usava emoji, o resto usava SVG).
 *
 * Este módulo é a **única** tradução entre o que o usuário digita e o que a
 * tela mostra. Segue o padrão dos outros registros do projeto
 * (`lib/rating-constants.js`, `lib/reputation-constants.js`).
 *
 * ## O contrato que torna a mudança segura
 *
 * `toUrl()` devolve a URL **absoluta que já está no banco sem tocar nela**,
 * mesmo quando não reconhece o tipo. Todo contato existente continua
 * funcionando; o que muda é só o que aparece na tela. É por isso que nenhuma
 * migração de dados é obrigatória — e por isso `serializeContact` nunca lança e
 * nunca descarta um contato: na leitura o comportamento é sempre permissivo.
 *
 * A validação estrita fica no `normalize`, que roda **apenas na escrita**.
 *
 * ## Adicionar um tipo
 *
 * Basta acrescentar a entrada aqui. Um `icon_key` sem entrada cai em
 * `GENERIC` — continua funcionando, só não ganha handle nem validação. Isso é
 * intencional: `contact_type` é gerenciável em runtime por
 * `/admin/contact-types`, então a tabela (e não este arquivo) é a fonte da
 * lista de tipos disponíveis.
 */
// Caminho relativo COM extensão, e não `@/lib/phone`: o script de backfill roda
// em Node puro, onde nem o alias `@/` nem a resolução sem extensão existem.
import { formatBrPhone, toE164Br } from "./phone.js";

/** Teto do `contact_value` no banco (`VARCHAR(255)`). */
const MAX_VALUE_LENGTH = 255;

/** URL absoluta que não é de nenhum tipo conhecido: continua clicável. */
function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(value);
}

/**
 * Definição de um tipo de contato.
 *
 * @typedef {object} ContactType
 * @property {string} label        Nome exibido ("YouTube", "WhatsApp").
 * @property {string} [placeholder] Exemplo mostrado no campo de cadastro.
 * @property {string} [hint]       Orientação curta exibida abaixo do campo.
 * @property {(value: string) => string} normalize
 *   Converte o que o usuário digitou na forma canônica gravada no banco.
 *   Devolve a string **inalterada** quando não reconhece — nunca lança.
 * @property {(value: string) => boolean} [isValid]
 *   Só quando o tipo exige formato (telefone). Sem isso, qualquer texto passa.
 * @property {(value: string) => string|null} toUrl
 *   `href` para o contato, ou `null` quando não é clicável. Best-effort.
 * @property {(value: string) => string|null} display
 *   Handle legível ("@canal"), ou `null` para usar o próprio valor.
 */

/** Remove `www.` e a barra final — usado para exibir domínio como rótulo. */
function bareHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Verifica se o valor é um endereço de e-mail.
 *
 * Feito à mão em vez de regex de propósito: o padrão
 * `algo@algo.algo` com quantificadores sobrepostos (`[^@\s]+@[^@\s]+\.[^@\s]+`)
 * é o exemplo clássico de retrocesso catastrófico. Aqui é uma passada só,
 * linear no tamanho da string, e as regras ficam explícitas.
 * @param {string} value
 * @returns {boolean}
 */
function isEmail(value) {
  if (/\s/.test(value)) return false;

  const at = value.indexOf("@");
  // Precisa de exatamente um `@`, e não pode estar na primeira posição.
  if (at <= 0 || at !== value.lastIndexOf("@")) return false;

  const domain = value.slice(at + 1);
  return domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".");
}

/** Aceita `@algo` e devolve `algo`; senão, `null`. */
function handleShorthand(value) {
  const match = /^@([\w.-]+)$/.exec(String(value).trim());
  return match ? match[1] : null;
}

/**
 * Extrai o primeiro grupo que casar, testando os padrões **em ordem**.
 *
 * A ordem importa: `/@canal` precisa ser testado antes de `/c/canal`, senão um
 * link `/@nome` seria lido pelo padrão errado e devolveria `null`.
 */
function firstMatch(value, patterns) {
  for (const pattern of patterns) {
    const match = pattern.exec(String(value));
    if (match) return match.slice(1).find(Boolean) ?? null;
  }
  return null;
}

/** @type {Record<string, ContactType>} */
const CONTACT_TYPES = {
  youtube: {
    label: "YouTube",
    placeholder: "https://youtube.com/@seucanal",
    hint: "Cole o link do canal, ou só o @usuario.",
    normalize(value) {
      const handle = handleShorthand(value);
      if (handle) return `https://www.youtube.com/@${handle}`;
      return value;
    },
    toUrl(value) {
      return /youtube\.com|youtu\.be/i.test(value) ? value : null;
    },
    display(value) {
      const handle = firstMatch(value, [
        /youtube\.com\/@([\w.-]+)/i,
        /youtube\.com\/c\/([\w.-]+)/i,
        /youtube\.com\/user\/([\w.-]+)/i,
        /youtube\.com\/channel\/([\w-]+)/i,
      ]);
      if (handle) return `@${handle}`;
      // Vídeo avulso não é canal: o rótulo do tipo diz mais que o ID.
      if (/youtu\.be\/|youtube\.com\/(watch|shorts|embed|live)/i.test(value)) return "Vídeo";
      return null;
    },
  },

  instagram: {
    label: "Instagram",
    placeholder: "https://instagram.com/seuusuario",
    hint: "Cole o link do perfil, ou só o @usuario.",
    normalize(value) {
      const handle = handleShorthand(value);
      if (handle) return `https://www.instagram.com/${handle}/`;
      return value;
    },
    toUrl(value) {
      return /instagram\.com/i.test(value) ? value : null;
    },
    display(value) {
      const handle = firstMatch(value, [/instagram\.com\/([\w.-]+)\/?/i]);
      return handle && !["p", "reel", "reels", "stories", "tv"].includes(handle) ? `@${handle}` : null;
    },
  },

  tiktok: {
    label: "TikTok",
    placeholder: "https://tiktok.com/@seuusuario",
    hint: "Cole o link do perfil, ou só o @usuario.",
    normalize(value) {
      const handle = handleShorthand(value);
      if (handle) return `https://www.tiktok.com/@${handle}`;
      return value;
    },
    toUrl(value) {
      return /tiktok\.com/i.test(value) ? value : null;
    },
    display(value) {
      const handle = firstMatch(value, [/tiktok\.com\/@([\w.-]+)/i]);
      return handle ? `@${handle}` : null;
    },
  },

  twitch: {
    label: "Twitch",
    placeholder: "https://twitch.tv/seucanal",
    hint: "Cole o link do canal, ou só o nome dele.",
    normalize(value) {
      const handle = handleShorthand(value);
      if (handle) return `https://www.twitch.tv/${handle}`;
      // Nome solto (`greentale`) é aceito aqui — no Twitch o canal é o próprio
      // identificador, sem prefixo. Só não confundimos com link de outra coisa.
      if (/^[\w-]{3,25}$/.test(String(value).trim())) {
        return `https://www.twitch.tv/${String(value).trim()}`;
      }
      return value;
    },
    toUrl(value) {
      return /twitch\.tv/i.test(value) ? value : null;
    },
    display(value) {
      const handle = firstMatch(value, [/twitch\.tv\/([\w-]+)/i]);
      return handle ? `@${handle}` : null;
    },
  },

  discord: {
    label: "Discord",
    placeholder: "https://discord.gg/codigodoconvite",
    hint: "Convite do servidor (`discord.gg/…`) ou seu @usuario.",
    normalize(value) {
      // Só o link vira convite. Um nome solto (`meuuser`) NÃO é convertido:
      // seria indistinguível de um convite e geraria um link falso para
      // `discord.gg/meuuser`. Na dúvida, o valor fica como está e o cartão
      // exibe sem âncora — errar para menos é melhor que inventar um destino.
      const invite = firstMatch(value, [/discord(?:app)?\.(?:gg|com\/invite)\/([\w-]+)/i]);
      if (invite) return `https://discord.gg/${invite}`;
      return value;
    },
    toUrl(value) {
      return /discord\.(?:gg|com)/i.test(value) ? value : null;
    },
    display(value) {
      const invite = firstMatch(value, [/discord(?:app)?\.(?:gg|com\/invite)\/([\w-]+)/i]);
      if (invite) return `discord.gg/${invite}`;
      const user = handleShorthand(value);
      return user ? `@${user}` : null;
    },
  },

  telegram: {
    label: "Telegram",
    placeholder: "https://t.me/seuusuario",
    hint: "Cole o link do perfil, ou só o @usuario.",
    normalize(value) {
      const handle = handleShorthand(value);
      if (handle) return `https://t.me/${handle}`;
      return value;
    },
    toUrl(value) {
      return /t\.me|telegram\.me/i.test(value) ? value : null;
    },
    display(value) {
      const handle = firstMatch(value, [/(?:t\.me|telegram\.me)\/(\w+)/i]);
      return handle ? `@${handle}` : null;
    },
  },

  github: {
    label: "GitHub",
    placeholder: "https://github.com/seuusuario",
    hint: "Cole o link do perfil, ou só o @usuario.",
    normalize(value) {
      const handle = handleShorthand(value);
      if (handle) return `https://github.com/${handle}`;
      return value;
    },
    toUrl(value) {
      return /github\.com/i.test(value) ? value : null;
    },
    display(value) {
      const handle = firstMatch(value, [/github\.com\/([\w-]+)\/?/i]);
      return handle ? `@${handle}` : null;
    },
  },

  linkedin: {
    label: "LinkedIn",
    placeholder: "https://linkedin.com/in/seuperfil",
    hint: "Cole o link do perfil pessoal (`/in/…`) ou da página da empresa (`/company/…`).",
    normalize: (value) => value,
    toUrl(value) {
      return /linkedin\.com/i.test(value) ? value : null;
    },
    display(value) {
      const slug = firstMatch(value, [/linkedin\.com\/(?:in|company)\/([\w-]+)/i]);
      return slug ? `/${slug}` : null;
    },
  },

  steam: {
    label: "Steam",
    placeholder: "https://steamcommunity.com/id/seuperfil",
    hint: "Perfil da comunidade ou a página do desenvolvedor na loja.",
    normalize: (value) => value,
    toUrl(value) {
      return /steam(?:community|powered)\.com/i.test(value) ? value : null;
    },
    display(value) {
      const custom = firstMatch(value, [/steamcommunity\.com\/id\/([\w-]+)/i]);
      if (custom) return custom;

      const profile = firstMatch(value, [/steamcommunity\.com\/profiles\/(\d+)/i]);
      if (profile) return "Perfil Steam";

      // `%20` e `+` são a mesma coisa na query da loja.
      const developer = firstMatch(value, [/store\.steampowered\.com\/developer\/([\w%+.-]+)/i]);
      if (developer) return `Jogos de ${decodeURIComponent(developer).replaceAll("+", " ")}`;

      // Página de busca é um contato legítimo (foi o que o Green Tale usou),
      // só não é um perfil — o rótulo evita prometer o que não existe.
      if (/\/search\//i.test(value)) return "Jogos na Steam";
      return null;
    },
  },

  "itch.io": {
    label: "itch.io",
    placeholder: "https://seuestudio.itch.io",
    hint: "Cole o link da sua página, ou só o subdomínio.",
    normalize(value) {
      // `greentale` ou `greentale.itch.io` viram URL completa.
      const sub = firstMatch(value, [/^([\w-]+)\.itch\.io\/?$/i, /^([\w-]+)$/]);
      if (sub) return `https://${sub}.itch.io/`;
      return value;
    },
    toUrl(value) {
      return /itch\.io/i.test(value) ? value : null;
    },
    display(value) {
      const sub = firstMatch(value, [/^(?:https?:\/\/)?([\w-]+)\.itch\.io/i]);
      return sub ? `${sub}.itch.io` : null;
    },
  },

  twitter: {
    label: "X (Twitter)",
    placeholder: "https://x.com/seuusuario",
    hint: "Cole o link do perfil, ou só o @usuario.",
    normalize(value) {
      const handle = handleShorthand(value);
      if (handle) return `https://x.com/${handle}`;
      return value;
    },
    toUrl(value) {
      return /(?:twitter|x)\.com/i.test(value) ? value : null;
    },
    display(value) {
      const handle = firstMatch(value, [/(?:twitter|x)\.com\/(\w+)\/?/i]);
      return handle ? `@${handle}` : null;
    },
  },

  email: {
    label: "E-mail",
    placeholder: "contato@seuestudio.com",
    hint: "Endereço de e-mail.",
    normalize: (value) =>
      String(value)
        .trim()
        .replace(/^mailto:/i, ""),
    toUrl(value) {
      return isEmail(value) ? `mailto:${value}` : null;
    },
    display: (value) => value,
  },

  whatsapp: {
    label: "WhatsApp",
    placeholder: "(11) 99999-9999",
    hint: "Só o número, com DDD. Fixo ou celular — o link é montado sozinho.",
    normalize(value) {
      // Link pronto é preservado (o usuário pode ter um convite wa.me).
      if (/wa\.me|whatsapp\.com|api\.whatsapp/i.test(String(value))) return value;
      const e164 = toE164Br(value);
      return e164 ? `https://wa.me/${e164}` : String(value).trim();
    },
    // Diferente dos outros tipos, aqui o formato é obrigatório: um telefone
    // inválido não vira link utilizável, e é o dado que mais chega errado.
    isValid(value) {
      return /wa\.me|whatsapp\.com/i.test(String(value)) || toE164Br(value) !== "";
    },
    toUrl(value) {
      const e164 = firstMatch(value, [/wa\.me\/(\d{10,15})/i, /(?:phone=)(\d{10,15})/i]);
      return e164 ? `https://wa.me/${e164}` : null;
    },
    display(value) {
      const e164 = firstMatch(value, [/wa\.me\/(\d{10,15})/i, /(?:phone=)(\d{10,15})/i]);
      if (e164) return formatBrPhone(e164.slice(2)) || `+${e164}`;
      return null;
    },
  },

  fone: {
    label: "Fone",
    placeholder: "(11) 3333-4444",
    hint: "Só o número, com DDD. Fixo ou celular.",
    normalize(value) {
      if (/^tel:/i.test(String(value))) return value;
      const e164 = toE164Br(value);
      return e164 ? `tel:+${e164}` : String(value).trim();
    },
    isValid(value) {
      return /^tel:/i.test(String(value)) || toE164Br(value) !== "";
    },
    toUrl(value) {
      const e164 = firstMatch(value, [/tel:\+?(\d{10,15})/i]);
      return e164 ? `tel:+${e164}` : null;
    },
    display(value) {
      const e164 = firstMatch(value, [/tel:\+?(\d{10,15})/i]);
      if (e164) return formatBrPhone(e164.slice(2)) || `+${e164}`;
      return null;
    },
  },

  website: {
    label: "Site",
    placeholder: "https://seuestudio.com",
    hint: "O endereço do site ou da página do estúdio.",
    normalize(value) {
      const raw = String(value).trim();
      // "meusite.com" é o que a pessoa digita; sem isso o valor não vira link.
      if (!isAbsoluteUrl(raw) && /^[\w-]+(\.[\w-]+)+/.test(raw)) return `https://${raw}`;
      return raw;
    },
    toUrl(value) {
      return isAbsoluteUrl(value) ? value : null;
    },
    display(value) {
      const host = bareHost(value.startsWith("http") ? value : `https://${value}`);
      return host || null;
    },
  },
};

/**
 * Definição usada quando o tipo não está no registro — um `contact_type` criado
 * pelo admin, ou um nome que mudou. Mantém o contato clicável e legível sem
 * exigir alteração de código.
 * @type {ContactType}
 */
const GENERIC = {
  label: null,
  placeholder: "https://… ou texto",
  hint: "Cole o link completo do seu perfil.",
  normalize: (value) => String(value).trim(),
  toUrl: (value) => (isAbsoluteUrl(value) ? value : null),
  display: () => null,
};

/**
 * Aliases de `icon_key` para a chave do registro.
 *
 * A tabela guarda o `icon_key` com a grafia que o admin escolheu ("GitHub",
 * "Itch.io", "Youtube"), então o casamento é por minúsculas e com sinônimos.
 */
const KEY_ALIASES = {
  yt: "youtube",
  itch: "itch.io",
  itchdotio: "itch.io",
  whatsapp: "whatsapp",
  whats: "whatsapp",
  telefone: "fone",
  phone: "fone",
  celular: "fone",
  site: "website",
  web: "website",
  x: "twitter",
};

/**
 * Normaliza o `icon_key` para a chave do registro.
 * @param {*} iconKey
 * @returns {string}
 */
function normalizeKey(iconKey) {
  const key = String(iconKey ?? "")
    .trim()
    .toLowerCase();
  return KEY_ALIASES[key] ?? key;
}

/**
 * Chave canônica de um `icon_key`, para comparar tipos entre si.
 *
 * A tabela guarda a grafia escolhida pelo admin ("Youtube", "Itch.io") e o
 * `detectContactType` devolve a chave do registro ("youtube", "itch.io"). Sem
 * esta função, o formulário não teria como saber que os dois são o mesmo tipo —
 * e a inferência automática simplesmente não acharia o `<option>`.
 * @param {*} iconKey
 * @returns {string}
 */
export function toContactKey(iconKey) {
  return normalizeKey(iconKey);
}

/**
 * Definição de um tipo pelo `icon_key` do banco.
 * @param {*} iconKey
 * @returns {ContactType}
 */
export function getContactType(iconKey) {
  return CONTACT_TYPES[normalizeKey(iconKey)] ?? GENERIC;
}

/**
 * Rótulo exibido do tipo. Cai no próprio `icon_key` capitalizado quando o tipo
 * não está no registro — melhor que sumir com a informação.
 * @param {*} iconKey
 * @returns {string}
 */
export function getContactLabel(iconKey) {
  const type = getContactType(iconKey);
  if (type.label) return type.label;

  const raw = String(iconKey ?? "").trim();
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "Contato";
}

/**
 * Domínios reconhecidos, em ordem.
 *
 * Tabela em vez de cadeia de `if`: é mais fácil de ler, de conferir contra
 * `CONTACT_TYPES` (toda chave aqui existe lá) e de acrescentar um tipo — a
 * alternativa eram dezessete ramos aninhados.
 * @type {Array<[RegExp, string]>}
 */
const HOST_PATTERNS = [
  [/youtube\.com|youtu\.be/, "youtube"],
  [/instagram\.com/, "instagram"],
  [/tiktok\.com/, "tiktok"],
  [/twitch\.tv/, "twitch"],
  [/discord\.(gg|com)/, "discord"],
  [/t\.me|telegram\.me/, "telegram"],
  [/github\.com/, "github"],
  [/linkedin\.com/, "linkedin"],
  [/steam(community|powered)\.com/, "steam"],
  [/itch\.io/, "itch.io"],
  [/(twitter|x)\.com/, "twitter"],
  [/wa\.me|whatsapp\.com/, "whatsapp"],
];

/**
 * Descobre o tipo a partir do que foi colado.
 *
 * É o que permite o cadastro "colar primeiro, tipo depois": a pessoa cola o
 * link e o formulário já marca o tipo certo.
 *
 * Devolve `null` quando não há como decidir sem chutar — `@usuario` serve a
 * várias redes, e o domínio desconhecido pode ser qualquer coisa. Nesses casos
 * o chamador mantém o tipo que o usuário já escolheu, em vez de sobrescrevê-lo.
 * @param {*} value
 * @returns {string|null} chave do registro (ex.: `"youtube"`), ou `null`.
 */
export function detectContactType(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  if (isEmail(raw)) return "email";
  if (handleShorthand(raw)) return null; // @usuario é ambíguo: não chuta.

  const host = bareHost(raw.startsWith("http") ? raw : `https://${raw}`);
  if (!host) return null;

  const found = HOST_PATTERNS.find(([pattern]) => pattern.test(host));
  return found ? found[1] : "website";
}

/**
 * Aplica o tipo a um valor digitado, devolvendo a forma canônica.
 *
 * Roda **apenas na escrita**. Resultado em objeto (e não exceção) para o
 * chamador montar a mensagem de erro com o motivo real — `ValidationError` é
 * responsabilidade da camada de API, não deste módulo.
 *
 * @param {*} iconKey
 * @param {*} rawValue
 * @returns {{ ok: true, value: string } | { ok: false, reason: string }}
 */
export function normalizeContactValue(iconKey, rawValue) {
  const raw = typeof rawValue === "string" ? rawValue.trim() : "";

  if (!raw) {
    return { ok: false, reason: "Informe o valor do contato." };
  }
  if (raw.length > MAX_VALUE_LENGTH) {
    return { ok: false, reason: `O contato não pode passar de ${MAX_VALUE_LENGTH} caracteres.` };
  }

  const type = getContactType(iconKey);
  const value = type.normalize(raw);

  if (type.isValid && !type.isValid(value)) {
    return {
      ok: false,
      reason: `"${raw}" não é um telefone válido. Use DDD + número, fixo ou celular.`,
    };
  }

  return { ok: true, value };
}

/**
 * Enriquece um contato vindo do banco com o que a tela precisa para exibi-lo.
 *
 * Campos acrescentados:
 *  - `url`     href já resolvido (ou `null` quando não é clicável);
 *  - `display` handle legível ("@canal"), ou `null` para a tela mostrar
 *              o próprio `contact_value`;
 *  - `label`   rótulo do tipo, para o `title`/tooltip e para leitores de tela.
 *
 * **Nunca lança e nunca descarta**: um valor estranho no banco vira um contato
 * sem link, não um erro de renderização.
 *
 * @param {object} row — linha de `users_contacts`/`organization_contacts` com
 *   `contact_value`, `icon_key` e `icon_img`.
 * @returns {object}
 */
export function serializeContact(row) {
  const value = typeof row?.contact_value === "string" ? row.contact_value : "";
  const type = getContactType(row?.icon_key);

  let url = null;
  let display = null;

  try {
    url = type.toUrl(value);
    display = type.display(value);
  } catch {
    // Tipo com implementação defeituosa não pode derrubar a página — o contato
    // aparece sem link, que é a degradação segura.
    url = null;
    display = null;
  }

  return {
    ...row,
    url,
    display,
    label: getContactLabel(row?.icon_key),
  };
}
