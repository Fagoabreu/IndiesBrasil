/**
 * Ícones de profissão disponíveis.
 *
 * A lista é o conteúdo de `public/images/professions/` — vinte e cinco PNGs, um
 * por profissão original. Uma profissão nova reutiliza um ícone existente
 * (escolhido pelo admin ao aprovar a sugestão) em vez de pedir um arquivo.
 *
 * ## Por que a lista existe, e não um campo livre
 *
 * O `icon_img` vira `src={`/images/professions/${icon_img}.png`}` na página do
 * perfil. Campo livre aceita `"nao-existe"`, e o navegador só descobre o 404 na
 * hora de renderizar — imagem quebrada no perfil de quem já declarou a
 * especialidade, sem nenhum aviso para quem cadastrou. O `select` fecha isso na
 * origem.
 *
 * Criar um ícone novo é: soltar o PNG em `public/images/professions/` e
 * acrescentar o nome nesta lista. `tests/unit/lib/professionIcons.test.js`
 * confere que todo nome declarado tem arquivo — acrescentar só aqui quebra o
 * teste, e é intencional.
 */

/** Nome do arquivo (sem extensão) → rótulo exibido no seletor. */
export const PROFESSION_ICONS = [
  { key: "2DArtist", label: "Artista 2D" },
  { key: "3DArtist", label: "Artista 3D" },
  { key: "Animator", label: "Animador" },
  { key: "TechnicalArtist", label: "Artista Técnico" },
  { key: "GameDesigner", label: "Designer de Jogos" },
  { key: "LevelDesigner", label: "Designer de Nível" },
  { key: "SystemDesigner", label: "Designer de Sistema" },
  { key: "NarrativeDesigner", label: "Designer de Narrativa" },
  { key: "TechnicalDesigner", label: "Designer Técnico" },
  { key: "UIUXDesigner", label: "Designer de UI/UX" },
  { key: "GameProgrammer", label: "Programador de Jogos" },
  { key: "EngineProgrammer", label: "Programador de Motor" },
  { key: "GraphicsProgrammer", label: "Programador Gráfico" },
  { key: "GameplayProgrammer", label: "Programador de Jogabilidade" },
  { key: "SoundDesigner", label: "Designer de Som" },
  { key: "Composer", label: "Compositor" },
  { key: "GameProducer", label: "Produtor" },
  { key: "AssociateProducer", label: "Sócio" },
  { key: "TechnicalDirector", label: "Diretor Técnico" },
  { key: "TesterQA", label: "Analista QA" },
  { key: "Writer", label: "Escritor" },
  { key: "CommunityManager", label: "Gestor de Comunidade" },
  { key: "Educador", label: "Educador" },
  { key: "Influencer", label: "Produtor Digital" },
  { key: "Journal", label: "Jornalista" },
];

const ICON_KEYS = new Set(PROFESSION_ICONS.map((icon) => icon.key));

/** Verdadeiro quando o arquivo do ícone existe na lista. */
export function isValidProfessionIcon(key) {
  return ICON_KEYS.has(key);
}

/** Rótulo do ícone, ou a própria chave quando ela não existe (dado legado). */
export function professionIconLabel(key) {
  return PROFESSION_ICONS.find((icon) => icon.key === key)?.label ?? key;
}
