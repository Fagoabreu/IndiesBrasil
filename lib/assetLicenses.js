/**
 * Licenças aceitas para assets referenciados externamente.
 *
 * O asset não é hospedado aqui: o estúdio guarda apenas o endereço público e a
 * licença sob a qual ele foi publicado. Declarar a licença é o que permite a
 * quem consome saber o que pode fazer com o arquivo — e é o único dado de
 * direito autoral que o site publica.
 *
 * `unknown` é o padrão de propósito: o cadastro nunca inventa uma licença que
 * o estúdio não informou.
 */
export const ASSET_LICENSES = {
  cc0: {
    label: "CC0 (domínio público)",
    url: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  "cc-by": {
    label: "CC BY (atribuição)",
    url: "https://creativecommons.org/licenses/by/4.0/",
  },
  "cc-by-sa": {
    label: "CC BY-SA (atribuição + compartilha igual)",
    url: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  mit: {
    label: "MIT",
    url: "https://opensource.org/licenses/MIT",
  },
  "apache-2": {
    label: "Apache 2.0",
    url: "https://www.apache.org/licenses/LICENSE-2.0",
  },
  gpl: {
    label: "GPL",
    url: "https://www.gnu.org/licenses/gpl-3.0.html",
  },
  proprietary: {
    label: "Proprietária / licença própria",
    url: null,
  },
  unknown: {
    label: "Não informada",
    url: null,
  },
};

export const ASSET_LICENSE_KEYS = Object.keys(ASSET_LICENSES);
export const DEFAULT_ASSET_LICENSE = "unknown";

/** Rótulo da licença, ou a própria chave quando o valor não é conhecido. */
export function assetLicenseLabel(key) {
  return ASSET_LICENSES[key]?.label ?? key;
}

/** Sugestões de origem mostradas no formulário (texto livre, não enum). */
export const ASSET_SOURCES = [
  "itch.io",
  "Kenney",
  "OpenGameArt",
  "Unity Asset Store",
  "Unreal Marketplace",
  "Godot Asset Library",
  "GitHub",
  "Site próprio",
  "Outro",
];
