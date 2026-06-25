/**
 * Model: Classificação Indicativa
 *
 * Implementa o sistema de autoclassificação indicativa conforme:
 *   - Lei nº 15.211/2025 (ECA Digital) para jogos eletrônicos
 *   - Guia Prático ClassInd/MJSP (5ª Ed, 2025) faixas: L, 6, 10, 12, 14, 16, 18
 *   - Regras de segurança Inmetro para jogos de tabuleiro
 *   - Diretrizes editoriais brasileiras para livros
 *
 * Critérios ClassInd (jogos digitais):
 *   1. Violência
 *   2. Sexo e Nudez
 *   3. Drogas
 *
 * Cada critério é avaliado por um questionário. A resposta de maior
 * gravidade determina a faixa etária final.
 */

import database from "infra/database.js";
import { NotFoundError, ValidationError } from "infra/errors.js";
import { RATING_LABELS, RATING_COLORS, RATING_ORDER } from "@/lib/rating-constants";

export { RATING_LABELS, RATING_COLORS, RATING_ORDER };

/* =========================================================
 * Constantes — Questionários
 *
 * Cada pergunta tem:
 *   id        — identificador único
 *   text      — texto da pergunta
 *   options   — array de { value: "L|10|12|...", label: "descrição" }
 * ========================================================= */

/**
 * Questionário para Jogos Digitais
 *
 * Baseado no Guia Prático ClassInd 5ª Ed (2025). As perguntas
 * cobrem os 3 eixos: Violência, Sexo/Nudez, Drogas.
 * A faixa etária é o máximo entre os 3 eixos.
 */
export const GAME_QUESTIONNAIRE = {
  title: "Classificação Indicativa — Jogo Digital",
  description:
    "Este questionário segue as diretrizes do Guia Prático de Classificação Indicativa (ClassInd/MJSP, 5ª Edição, 2025) e da Lei nº 15.211/2025 (ECA Digital). Responda com atenção — a classificação tem valor legal.",
  sections: [
    {
      id: "violence",
      title: "Violência",
      description: "Avalie a presença e intensidade de violência no jogo.",
      questions: [
        {
          id: "v_arms",
          text: "O jogo contém exibição de armas?",
          options: [
            { value: "L", label: "Não contém armas." },
            { value: "10", label: "Armas de fantasia ou lúdicas, sem realismo (ex: varinha mágica, espada cartoon)." },
            { value: "12", label: "Armas brancas ou de fogo com baixo detalhamento, sem ferimentos visíveis." },
            { value: "14", label: "Armas realistas com impacto visual moderado (sangue estilizado)." },
            { value: "16", label: "Armas realistas com ferimentos detalhados e sangue." },
            { value: "18", label: "Violência armada extrema, mutilação ou tortura com riqueza de detalhes." },
          ],
        },
        {
          id: "v_confrontation",
          text: "Como é retratado o confronto físico no jogo?",
          options: [
            { value: "L", label: "Não há confronto físico ou é exclusivamente cômico/cartoon (ex: personagem achata e volta)." },
            { value: "10", label: "Confronto lúdico, sem sofrimento visível (ex: derrotar inimigos que somem)." },
            { value: "12", label: "Lutas com impacto leve, personagens caem mas sem ferimentos visíveis." },
            { value: "14", label: "Lutas com ferimentos moderados, hematomas ou sangue estilizado." },
            { value: "16", label: "Violência física intensa com ferimentos graves e sofrimento visível." },
            { value: "18", label: "Violência gráfica extrema, desmembramento, tortura ou execuções." },
          ],
        },
        {
          id: "v_death",
          text: "Como a morte é representada no jogo?",
          options: [
            { value: "L", label: "Não há morte de personagens." },
            { value: "10", label: "Morte implícita ou simbólica (personagem 'desmaia' ou vira estrela)." },
            { value: "12", label: "Morte sem detalhamento, personagem cai e desaparece." },
            { value: "14", label: "Morte com certo realismo, mas sem crueldade explícita." },
            { value: "16", label: "Mortes frequentes com impacto emocional ou violência." },
            { value: "18", label: "Mortes extremamente gráficas, assassinatos com riqueza de detalhes ou crueldade." },
          ],
        },
        {
          id: "v_vulnerable",
          text: "A violência atinge grupos vulneráveis (crianças, idosos, animais) ou ocorre em contexto de intolerância?",
          options: [
            { value: "L", label: "Não." },
            { value: "14", label: "Há sugestão ou menção, sem representação explícita." },
            { value: "16", label: "Há representação moderada de violência contra vulneráveis." },
            { value: "18", label: "Violência explícita contra vulneráveis ou apologia a crimes de ódio." },
          ],
        },
      ],
    },
    {
      id: "sex_nudity",
      title: "Sexo e Nudez",
      description: "Avalie a presença de conteúdo sexual ou nudez no jogo.",
      questions: [
        {
          id: "s_nudity",
          text: "O jogo contém nudez?",
          options: [
            { value: "L", label: "Não há nudez." },
            { value: "10", label: "Nudez não erótica e muito breve (ex: personagem de fralda, bebê)." },
            { value: "12", label: "Nudez parcial ou insinuação velada, sem conotação sexual." },
            { value: "14", label: "Nudez de relance em contexto não sexual (ex: silhueta, banho)." },
            { value: "16", label: "Nudez prolongada com conotação erótica." },
            { value: "18", label: "Nudez explícita em contexto sexual ou pornográfico." },
          ],
        },
        {
          id: "s_sexual_acts",
          text: "O jogo contém atos sexuais?",
          options: [
            { value: "L", label: "Não há atos sexuais." },
            { value: "10", label: "Beijos ou abraços românticos breves." },
            { value: "12", label: "Carícias ou insinuação sexual velada." },
            { value: "14", label: "Simulação de ato sexual sem nudez explícita." },
            { value: "16", label: "Atos sexuais com nudez parcial ou linguagem erótica." },
            { value: "18", label: "Atos sexuais explícitos ou conteúdo pornográfico." },
          ],
        },
        {
          id: "s_sexual_language",
          text: "O jogo contém linguagem de conotação sexual?",
          options: [
            { value: "L", label: "Não." },
            { value: "12", label: "Piadas ou insinuações leves." },
            { value: "14", label: "Diálogos com conteúdo erótico moderado." },
            { value: "16", label: "Linguagem sexual explícita e frequente." },
            { value: "18", label: "Linguagem obscena ou sexualmente degradante." },
          ],
        },
        {
          id: "s_exploitation",
          text: "O jogo contém exploração sexual ou sexualização de vulneráveis?",
          options: [
            { value: "L", label: "Não." },
            { value: "18", label: "Sim — qualquer insinuação ou representação." },
          ],
        },
      ],
    },
    {
      id: "drugs",
      title: "Drogas",
      description: "Avalie a presença de conteúdo relacionado a drogas lícitas e ilícitas.",
      questions: [
        {
          id: "d_licit",
          text: "O jogo retrata ou faz apologia ao consumo de drogas lícitas (álcool, tabaco)?",
          options: [
            { value: "L", label: "Não." },
            { value: "10", label: "Menção ou aparição breve, sem consumo explícito." },
            { value: "12", label: "Consumo moderado sem glamourização (ex: personagem adulto bebe vinho)." },
            { value: "14", label: "Consumo frequente ou associado a benefícios no jogo." },
            { value: "16", label: "Apologia ao consumo ou embriaguez como elemento cômico/habitual." },
            { value: "18", label: "Glamourização do consumo excessivo ou associação a recompensas." },
          ],
        },
        {
          id: "d_illicit",
          text: "O jogo retrata ou faz apologia ao consumo de drogas ilícitas?",
          options: [
            { value: "L", label: "Não." },
            { value: "12", label: "Menção breve em contexto educativo ou preventivo." },
            { value: "14", label: "Aparição de drogas sem consumo explícito (ex: item de inventário)." },
            { value: "16", label: "Consumo implícito ou representação moderada." },
            { value: "18", label: "Consumo explícito, glamourização ou tráfico como mecânica." },
          ],
        },
      ],
    },
    {
      id: "monetization",
      title: "Monetização e Compras (Lei Felca — PL 412/2022)",
      description:
        "Avalie a presença de lootboxes, compras dentro do jogo e publicidade. Conforme o PL 412/2022 (Lei Felca), jogos com lootboxes pagas ou compras que configurem exploração comercial de vulneráveis devem ser sinalizados com selo próprio.",
      questions: [
        {
          id: "m_lootboxes",
          text: "O jogo contém lootboxes (caixas de recompensa aleatória)?",
          options: [
            { value: "L", label: "Não há lootboxes." },
            { value: "L", label: "Lootboxes apenas cosméticas e gratuitas (ganhas jogando, sem dinheiro real)." },
            { value: "16", label: "Lootboxes pagas com dinheiro real, mas com divulgação clara de probabilidades e sem vantagem competitiva." },
            {
              value: "18",
              label:
                "Lootboxes pagas com dinheiro real e recompensas aleatórias que afetam a jogabilidade (pay-to-win) ou sem transparência de probabilidades.",
            },
          ],
        },
        {
          id: "m_purchases",
          text: "O jogo contém compras dentro do jogo (microtransações)?",
          options: [
            { value: "L", label: "Não há compras dentro do jogo." },
            { value: "10", label: "Apenas expansões ou DLCs que adicionam conteúdo substancial ao jogo base." },
            { value: "12", label: "Itens cosméticos pagos (skins, roupas, efeitos visuais) que não afetam a jogabilidade." },
            { value: "16", label: "Itens pagos que aceleram progressão ou oferecem vantagem competitiva (pay-to-win)." },
            {
              value: "18",
              label: "Compras predatórias: mecânicas que pressionam o jogador a gastar repetidamente (gacha, energia paga, mecânicas de cassino).",
            },
          ],
        },
        {
          id: "m_ads",
          text: "O jogo contém anúncios ou publicidade excessiva?",
          options: [
            { value: "L", label: "Sem anúncios ou apenas divulgação de outros jogos do mesmo estúdio de forma não intrusiva." },
            { value: "10", label: "Anúncios em áreas não interruptivas (ex: menu principal, tela de loading)." },
            { value: "12", label: "Anúncios entre fases ou momentos de pausa, sem interromper a jogabilidade." },
            { value: "14", label: "Anúncios frequentes ou direcionados a menores de idade com apelo comercial." },
            { value: "16", label: "Anúncios excessivos que interrompem a jogabilidade repetidamente ou induzem compras." },
          ],
        },
      ],
    },
  ],
};

/**
 * Questionário para Jogos de Tabuleiro
 *
 * Baseado em:
 *   - Regras de segurança do Inmetro (partes pequenas, risco de sufocamento)
 *   - Complexidade cognitiva conforme faixa etária
 *   - Temática do jogo
 *
 * NOTA: Jogos de tabuleiro NÃO têm classificação indicativa oficial
 * obrigatória no Brasil. A classificação aqui é uma SUGESTÃO baseada
 * em segurança física (Inmetro) e adequação temática/cognitiva.
 */
export const BOARDGAME_QUESTIONNAIRE = {
  title: "Classificação Sugerida — Jogo de Tabuleiro",
  description:
    "Jogos de tabuleiro não possuem classificação indicativa oficial obrigatória no Brasil. Este questionário sugere uma faixa etária com base em segurança física (Inmetro) e adequação cognitiva/temática. A decisão final é do produtor.",
  sections: [
    {
      id: "safety",
      title: "Segurança Física (Inmetro)",
      description: "Avalie riscos físicos conforme regulamentação do Inmetro para brinquedos e jogos.",
      questions: [
        {
          id: "bf_small_parts",
          text: "O jogo contém peças pequenas que podem ser engolidas (risco de sufocamento para menores de 3 anos)?",
          options: [
            { value: "L", label: "Não — peças grandes ou sem partes pequenas." },
            { value: "L", label: "Sim, mas jogo é claramente para maiores de 3 anos (aviso na embalagem)." },
            { value: "6", label: "Peças pequenas com risco moderado. Adequado para 6+." },
            { value: "10", label: "Peças muito pequenas ou numerosas. Melhor para 10+." },
          ],
        },
        {
          id: "bf_sharp",
          text: "O jogo contém peças pontiagudas, cortantes ou materiais frágeis que possam causar ferimentos?",
          options: [
            { value: "L", label: "Não." },
            { value: "10", label: "Peças com bordas finas ou materiais que exigem cuidado (ex: cartas de papel couché)." },
            { value: "14", label: "Componentes metálicos, miniaturas com partes pontiagudas ou vidro." },
          ],
        },
        {
          id: "bf_toxic",
          text: "O jogo utiliza materiais que podem ser tóxicos se ingeridos (tintas especiais, massinhas, adesivos)?",
          options: [
            { value: "L", label: "Não — todos os materiais são atóxicos e certificados." },
            { value: "6", label: "Materiais atóxicos, mas que exigem supervisão para crianças pequenas." },
            { value: "10", label: "Materiais que exigem supervisão para menores de 10 anos." },
          ],
        },
      ],
    },
    {
      id: "cognitive",
      title: "Complexidade Cognitiva",
      description: "Avalie a complexidade de regras e habilidades exigidas.",
      questions: [
        {
          id: "bc_reading",
          text: "O jogo exige leitura fluente para ser jogado?",
          options: [
            { value: "L", label: "Não — totalmente visual/icônico." },
            { value: "6", label: "Leitura básica (palavras soltas, números)." },
            { value: "10", label: "Leitura de frases curtas em cartas ou tabuleiro." },
            { value: "12", label: "Leitura de parágrafos ou regras com múltiplas etapas." },
          ],
        },
        {
          id: "bc_math",
          text: "O jogo exige raciocínio matemático ou lógico avançado?",
          options: [
            { value: "L", label: "Não — contagem simples ou nenhuma matemática." },
            { value: "6", label: "Soma/subtração simples." },
            { value: "10", label: "Multiplicação, divisão ou gestão de recursos básica." },
            { value: "14", label: "Cálculo estratégico com múltiplas variáveis, probabilidade." },
          ],
        },
        {
          id: "bc_strategy",
          text: "Qual o nível de profundidade estratégica do jogo?",
          options: [
            { value: "L", label: "Jogo puramente de sorte ou memória." },
            { value: "6", label: "Decisões táticas simples e imediatas." },
            { value: "10", label: "Planejamento de curto prazo (1-2 rodadas)." },
            { value: "14", label: "Estratégia de longo prazo com múltiplos caminhos de vitória." },
            { value: "16", label: "Alta complexidade, múltiplos sistemas interligados." },
          ],
        },
        {
          id: "bc_duration",
          text: "Qual o tempo médio de uma partida?",
          options: [
            { value: "L", label: "Até 15 minutos." },
            { value: "6", label: "15 a 30 minutos." },
            { value: "10", label: "30 a 60 minutos." },
            { value: "12", label: "60 a 120 minutos." },
            { value: "14", label: "Mais de 2 horas." },
          ],
        },
      ],
    },
    {
      id: "theme",
      title: "Temática e Conteúdo",
      description: "Avalie a adequação temática do jogo.",
      questions: [
        {
          id: "bt_horror",
          text: "O jogo contém temas de horror, terror ou suspense psicológico?",
          options: [
            { value: "L", label: "Não." },
            { value: "10", label: "Temas leves de mistério ou fantasia sombria (ex: Halloween cartoon)." },
            { value: "14", label: "Horror moderado com imagens impactantes ou atmosfera opressiva." },
            { value: "16", label: "Horror intenso, gore ou perturbação psicológica." },
          ],
        },
        {
          id: "bt_war",
          text: "O jogo aborda guerras, conflitos armados ou violência histórica?",
          options: [
            { value: "L", label: "Não." },
            { value: "12", label: "Conflito abstrato (ex: xadrez, War com peças sem representação humana)." },
            { value: "14", label: "Representação de conflitos históricos com moderação." },
            { value: "16", label: "Guerra representada com violência gráfica em ilustrações ou miniaturas." },
          ],
        },
        {
          id: "bt_adult_content",
          text: "O jogo contém conteúdo sexual, drogas ou linguagem adulta em suas ilustrações, textos ou temática?",
          options: [
            { value: "L", label: "Não." },
            { value: "14", label: "Insunuação leve em cartas ou ilustrações." },
            { value: "18", label: "Conteúdo adulto explícito (ex: Cards Against Humanity, jogos eróticos)." },
          ],
        },
      ],
    },
  ],
};

/**
 * Questionário para Livros e Quadrinhos
 *
 * Baseado em diretrizes editoriais brasileiras e na
 * categorização sugerida pelo usuário.
 */
export const BOOK_QUESTIONNAIRE = {
  title: "Classificação Sugerida — Livro/Quadrinho",
  description:
    "Livros e quadrinhos não possuem classificação indicativa oficial obrigatória no Brasil. Este questionário oferece uma sugestão com base no conteúdo da obra. A decisão final é do autor ou editor.",
  sections: [
    {
      id: "content",
      title: "Conteúdo e Temática",
      description: "Avalie os temas abordados na obra.",
      questions: [
        {
          id: "bk_violence",
          text: "A obra contém cenas de violência?",
          options: [
            { value: "L", label: "Não há violência ou é exclusivamente cômica/cartoon, sem consequências." },
            { value: "10", label: "Violência leve e não gráfica (empurrões, quedas cômicas)." },
            { value: "12", label: "Conflitos físicos com consequências, mas sem descrições gráficas de ferimentos." },
            { value: "16", label: "Violência intensa ou frequente com descrições detalhadas." },
            { value: "18", label: "Violência gráfica extrema, tortura ou crueldade com riqueza de detalhes." },
          ],
        },
        {
          id: "bk_sexual",
          text: "A obra contém conteúdo sexual?",
          options: [
            { value: "L", label: "Não há conteúdo sexual ou romântico." },
            { value: "10", label: "Romance inocente (mãos dadas, primeiro beijo)." },
            { value: "12", label: "Romance com alguma intensidade emocional (primeiros amores, descobertas). Sem descrições gráficas." },
            { value: "16", label: "Cenas de sexo implícitas ou linguagem erótica moderada." },
            { value: "18", label: "Conteúdo sexual explícito ou pornográfico." },
          ],
        },
        {
          id: "bk_language",
          text: "A obra contém linguagem imprópria?",
          options: [
            { value: "L", label: "Linguagem completamente adequada para todas as idades." },
            { value: "12", label: "Palavrões ocasionais ou gírias leves." },
            { value: "14", label: "Linguagem vulgar moderada ou frequente." },
            { value: "18", label: "Linguagem obscena, degradante ou discurso de ódio." },
          ],
        },
        {
          id: "bk_drugs",
          text: "A obra retrata uso de drogas?",
          options: [
            { value: "L", label: "Não." },
            { value: "12", label: "Menção breve ou educativa." },
            { value: "14", label: "Uso recreativo moderado, sem glamourização." },
            { value: "16", label: "Uso frequente ou descrições detalhadas de consumo." },
            { value: "18", label: "Apologia ao uso ou descrições extremamente detalhadas." },
          ],
        },
        {
          id: "bk_complexity",
          text: "Qual a complexidade de leitura da obra?",
          options: [
            { value: "L", label: "Livro ilustrado ou de atividades. Texto mínimo com muitas imagens. Foco em mediação de leitura." },
            { value: "10", label: "Textos mais longos com capítulos curtos. Vocabulário acessível para leitores iniciantes." },
            { value: "12", label: "Narrativa com tramas mais elaboradas. Adequado para leitores fluentes." },
            { value: "14", label: "Obra complexa com múltiplos personagens, tramas paralelas ou vocabulário avançado." },
            { value: "16", label: "Alta densidade literária. Temas filosóficos, políticos ou existenciais complexos." },
          ],
        },
      ],
    },
  ],
};

/* =========================================================
 * Funções de cálculo da classificação
 * ========================================================= */

/**
 * Calcula a classificação a partir das respostas do questionário.
 *
 * @param {Object} answers  — { "questionId": "L|6|10|12|14|16|18", ... }
 * @returns {{ rating: string, reasons: string[] }}
 */
export function calculateGameRating(answers) {
  const reasons = [];
  let maxRating = "L";

  // Violência
  const violenceQuestions = ["v_arms", "v_confrontation", "v_death", "v_vulnerable"];
  const violenceMax = getMaxFromAnswers(answers, violenceQuestions);
  if (RATING_ORDER.indexOf(violenceMax) > RATING_ORDER.indexOf(maxRating)) {
    maxRating = violenceMax;
  }
  if (violenceMax !== "L") {
    reasons.push(
      `Violência: classificação ${violenceMax} — ${
        violenceMax === "18"
          ? "violência gráfica extrema contra vulneráveis"
          : violenceMax === "16"
            ? "violência intensa com ferimentos graves"
            : violenceMax === "14"
              ? "violência moderada com sangue estilizado"
              : violenceMax === "12"
                ? "lutas com impacto leve"
                : "armas de fantasia sem violência realista"
      }`,
    );
  }

  // Sexo e Nudez
  const sexQuestions = ["s_nudity", "s_sexual_acts", "s_sexual_language", "s_exploitation"];
  const sexMax = getMaxFromAnswers(answers, sexQuestions);
  if (RATING_ORDER.indexOf(sexMax) > RATING_ORDER.indexOf(maxRating)) {
    maxRating = sexMax;
  }
  if (sexMax !== "L") {
    reasons.push(
      `Sexo e Nudez: classificação ${sexMax} — ${
        sexMax === "18"
          ? "conteúdo sexual explícito ou exploração sexual"
          : sexMax === "16"
            ? "atos sexuais com nudez parcial ou linguagem erótica"
            : sexMax === "14"
              ? "simulação de ato sexual ou nudez de relance"
              : sexMax === "12"
                ? "insinuação velada ou carícias"
                : "beijos românticos breves"
      }`,
    );
  }

  // Drogas
  const drugQuestions = ["d_licit", "d_illicit"];
  const drugMax = getMaxFromAnswers(answers, drugQuestions);
  if (RATING_ORDER.indexOf(drugMax) > RATING_ORDER.indexOf(maxRating)) {
    maxRating = drugMax;
  }
  if (drugMax !== "L") {
    reasons.push(
      `Drogas: classificação ${drugMax} — ${
        drugMax === "18"
          ? "consumo explícito de drogas ilícitas ou glamourização"
          : drugMax === "16"
            ? "apologia ao consumo ou embriaguez habitual"
            : drugMax === "14"
              ? "consumo frequente de drogas lícitas"
              : drugMax === "12"
                ? "consumo moderado ou menção educativa"
                : "menção ou aparição breve"
      }`,
    );
  }

  // Monetização (Lei Felca — PL 412/2022)
  const monetizationQuestions = ["m_lootboxes", "m_purchases", "m_ads"];
  const monetizationMax = getMaxFromAnswers(answers, monetizationQuestions);
  if (RATING_ORDER.indexOf(monetizationMax) > RATING_ORDER.indexOf(maxRating)) {
    maxRating = monetizationMax;
  }

  // Flags de monetização para o selo à parte (Lei Felca)
  const monetizationFlags = {
    hasLootboxes: answers.m_lootboxes === "16" || answers.m_lootboxes === "18",
    hasInGamePurchases: answers.m_purchases === "12" || answers.m_purchases === "16" || answers.m_purchases === "18",
    hasExcessiveAds: answers.m_ads === "14" || answers.m_ads === "16",
  };

  if (monetizationMax !== "L") {
    const flagParts = [];
    if (monetizationFlags.hasLootboxes) flagParts.push("lootboxes pagas");
    if (monetizationFlags.hasInGamePurchases) flagParts.push("compras no jogo");
    if (monetizationFlags.hasExcessiveAds) flagParts.push("anúncios excessivos");
    reasons.push(`Monetização (Lei Felca): classificação ${monetizationMax} — ${flagParts.join(", ") || "microtransações"}`);
  }

  if (maxRating === "L") {
    reasons.push("Conteúdo adequado para todas as idades.");
  }

  return { rating: maxRating, reasons, monetizationFlags };
}

/**
 * Calcula a classificação sugerida para jogo de tabuleiro.
 *
 * @param {Object} answers
 * @returns {{ rating: string, reasons: string[] }}
 */
export function calculateBoardgameRating(answers) {
  const reasons = [];
  let maxRating = "L";

  // Segurança física (se qualquer risco, sobe)
  const safetyQuestions = ["bf_small_parts", "bf_sharp", "bf_toxic"];
  const safetyMax = getMaxFromAnswers(answers, safetyQuestions);
  if (RATING_ORDER.indexOf(safetyMax) > RATING_ORDER.indexOf(maxRating)) {
    maxRating = safetyMax;
  }
  if (safetyMax !== "L") {
    reasons.push(
      `Segurança física (Inmetro): sugerido ${safetyMax}+ — ${
        safetyMax === "14"
          ? "componentes metálicos ou pontiagudos"
          : safetyMax === "10"
            ? "peças pequenas ou materiais que exigem supervisão"
            : "peças pequenas"
      }`,
    );
  }

  // Complexidade cognitiva
  const cognitiveQuestions = ["bc_reading", "bc_math", "bc_strategy", "bc_duration"];
  const cognitiveMax = getMaxFromAnswers(answers, cognitiveQuestions);
  if (RATING_ORDER.indexOf(cognitiveMax) > RATING_ORDER.indexOf(maxRating)) {
    maxRating = cognitiveMax;
  }
  if (cognitiveMax !== "L") {
    reasons.push(
      `Complexidade cognitiva: sugerido ${cognitiveMax}+ — ${
        cognitiveMax === "16"
          ? "alta complexidade estratégica"
          : cognitiveMax === "14"
            ? "planejamento de longo prazo"
            : cognitiveMax === "12"
              ? "leitura fluente necessária"
              : cognitiveMax === "10"
                ? "leitura e matemática básica"
                : "decisões táticas simples"
      }`,
    );
  }

  // Temática
  const themeQuestions = ["bt_horror", "bt_war", "bt_adult_content"];
  const themeMax = getMaxFromAnswers(answers, themeQuestions);
  if (RATING_ORDER.indexOf(themeMax) > RATING_ORDER.indexOf(maxRating)) {
    maxRating = themeMax;
  }
  if (themeMax !== "L") {
    reasons.push(
      `Temática: sugerido ${themeMax}+ — ${
        themeMax === "18"
          ? "conteúdo adulto explícito"
          : themeMax === "16"
            ? "horror intenso ou violência histórica gráfica"
            : themeMax === "14"
              ? "horror moderado ou conflitos históricos"
              : themeMax === "12"
                ? "conflito abstrato"
                : "temas leves de mistério"
      }`,
    );
  }

  if (maxRating === "L") {
    reasons.push("Jogo adequado para todas as idades, sem riscos de segurança.");
  }

  return { rating: maxRating, reasons };
}

/**
 * Calcula a classificação sugerida para livros/quadrinhos.
 *
 * @param {Object} answers
 * @returns {{ rating: string, reasons: string[] }}
 */
export function calculateBookRating(answers) {
  const reasons = [];
  let maxRating = "L";

  const contentQuestions = ["bk_violence", "bk_sexual", "bk_language", "bk_drugs", "bk_complexity"];
  const contentMax = getMaxFromAnswers(answers, contentQuestions);
  maxRating = contentMax;

  // Mapear para as categorias de livros
  if (answers.bk_violence) {
    const r = answers.bk_violence;
    if (r !== "L") {
      reasons.push(
        `Violência: ${RATING_LABELS[r] || r} — ${
          r === "18"
            ? "descrições gráficas extremas"
            : r === "16"
              ? "violência intensa detalhada"
              : r === "12"
                ? "conflitos com consequências sem descrições gráficas"
                : "violência leve não gráfica"
        }`,
      );
    }
  }
  if (answers.bk_sexual) {
    const r = answers.bk_sexual;
    if (r !== "L") {
      reasons.push(
        `Conteúdo sexual/romântico: ${RATING_LABELS[r] || r} — ${
          r === "18"
            ? "conteúdo sexual explícito"
            : r === "16"
              ? "cenas implícitas ou linguagem erótica"
              : r === "12"
                ? "romance com descobertas e primeiros amores"
                : "romance inocente"
        }`,
      );
    }
  }
  if (answers.bk_language) {
    const r = answers.bk_language;
    if (r !== "L") {
      reasons.push(
        `Linguagem: ${RATING_LABELS[r] || r} — ${
          r === "18" ? "linguagem obscena ou degradante" : r === "14" ? "linguagem vulgar frequente" : "palavrões ocasionais"
        }`,
      );
    }
  }
  if (answers.bk_drugs) {
    const r = answers.bk_drugs;
    if (r !== "L") {
      reasons.push(
        `Drogas: ${RATING_LABELS[r] || r} — ${
          r === "18"
            ? "apologia ou descrições detalhadas"
            : r === "16"
              ? "uso frequente"
              : r === "14"
                ? "uso recreativo moderado"
                : "menção breve ou educativa"
        }`,
      );
    }
  }
  if (answers.bk_complexity) {
    const r = answers.bk_complexity;
    if (r !== "L") {
      reasons.push(
        `Complexidade de leitura: ${RATING_LABELS[r] || r} — ${
          r === "16"
            ? "alta densidade literária com temas complexos"
            : r === "14"
              ? "obra complexa com múltiplos personagens"
              : r === "12"
                ? "tramas elaboradas para leitores fluentes"
                : "textos mais longos com capítulos curtos"
        }`,
      );
    }
  }

  if (maxRating === "L") {
    reasons.push("Obra adequada para todas as idades. Livro ilustrado ou de atividades com mediação de leitura.");
  }

  return { rating: maxRating, reasons };
}

/* =========================================================
 * Helpers
 * ========================================================= */

function getMaxFromAnswers(answers, questionIds) {
  let max = "L";
  for (const qid of questionIds) {
    const value = answers[qid];
    if (value && RATING_ORDER.indexOf(value) > RATING_ORDER.indexOf(max)) {
      max = value;
    }
  }
  return max;
}

/* =========================================================
 * Persistência — Salvar classificação no banco
 * ========================================================= */

const TABLE_MAP = {
  game: "games",
  boardgame: "boardgames",
  book: "books",
};

const TABLE_DISPLAY = {
  game: "Jogo",
  boardgame: "Jogo de mesa",
  book: "Livro/quadrinho",
};

/**
 * Salva a classificação indicativa de um item.
 *
 * @param {string} type    — "game" | "boardgame" | "book"
 * @param {string} slug    — slug do item
 * @param {string} rating  — "L" | "6" | "10" | "12" | "14" | "16" | "18"
 * @param {string[]} reasons — array de strings com os motivos
 * @param {string} userId  — quem está classificando
 * @param {Object} [monetizationFlags] — { hasLootboxes, hasInGamePurchases, hasExcessiveAds } (apenas para games, Lei Felca)
 * @returns {Object} — item atualizado
 */
async function saveRating(type, slug, rating, reasons, userId, monetizationFlags) {
  const table = TABLE_MAP[type];
  if (!table) {
    throw new ValidationError({ message: `Tipo inválido: "${type}". Use game, boardgame ou book.` });
  }

  if (!RATING_LABELS[rating]) {
    throw new ValidationError({ message: `Classificação inválida: "${rating}". Valores válidos: ${Object.keys(RATING_LABELS).join(", ")}` });
  }

  // Verificar se o item existe
  const result = await database.query({
    text: `SELECT id, owner_id, owner_org_id FROM ${table} WHERE slug = $1`,
    values: [slug],
  });

  if (!result.rows[0]) {
    throw new NotFoundError({ message: `${TABLE_DISPLAY[type]} "${slug}" não encontrado.` });
  }

  // O userId é recebido para futura validação de permissão (owner/org admin).
  // Atualmente confiamos na autenticação do endpoint.
  void userId;

  // Atualizar classificação indicativa + flags de monetização (Lei Felca, apenas games)
  if (type === "game" && monetizationFlags) {
    await database.query({
      text: `
        UPDATE ${table}
        SET content_rating = $2,
            content_rating_reasons = $3,
            content_rated_at = now(),
            has_lootboxes = $4,
            has_in_game_purchases = $5,
            has_excessive_ads = $6,
            updated_at = now()
        WHERE slug = $1
      `,
      values: [
        slug,
        rating,
        JSON.stringify(reasons),
        monetizationFlags.hasLootboxes || false,
        monetizationFlags.hasInGamePurchases || false,
        monetizationFlags.hasExcessiveAds || false,
      ],
    });
  } else {
    await database.query({
      text: `
        UPDATE ${table}
        SET content_rating = $2,
            content_rating_reasons = $3,
            content_rated_at = now(),
            updated_at = now()
        WHERE slug = $1
      `,
      values: [slug, rating, JSON.stringify(reasons)],
    });
  }

  return { rating, reasons, type, slug, monetizationFlags: monetizationFlags || null };
}

/**
 * Busca a classificação atual de um item.
 *
 * @param {string} type — "game" | "boardgame" | "book"
 * @param {string} slug
 * @returns {{ rating: string|null, reasons: string[]|null, ratedAt: string|null, monetizationFlags: Object|null }}
 */
async function getRating(type, slug) {
  const table = TABLE_MAP[type];
  if (!table) {
    throw new ValidationError({ message: `Tipo inválido: "${type}".` });
  }

  const monetizationCols = type === "game" ? ", has_lootboxes, has_in_game_purchases, has_excessive_ads" : "";

  const result = await database.query({
    text: `SELECT content_rating, content_rating_reasons, content_rated_at${monetizationCols} FROM ${table} WHERE slug = $1`,
    values: [slug],
  });

  if (!result.rows[0]) {
    throw new NotFoundError({ message: `${TABLE_DISPLAY[type]} "${slug}" não encontrado.` });
  }

  const row = result.rows[0];
  const response = {
    rating: row.content_rating || null,
    reasons: row.content_rating_reasons ? JSON.parse(row.content_rating_reasons) : null,
    ratedAt: row.content_rated_at || null,
  };

  if (type === "game") {
    response.monetizationFlags = {
      hasLootboxes: row.has_lootboxes || false,
      hasInGamePurchases: row.has_in_game_purchases || false,
      hasExcessiveAds: row.has_excessive_ads || false,
    };
  }

  return response;
}

const contentRating = {
  RATING_LABELS,
  RATING_COLORS,
  RATING_ORDER,
  GAME_QUESTIONNAIRE,
  BOARDGAME_QUESTIONNAIRE,
  BOOK_QUESTIONNAIRE,
  calculateGameRating,
  calculateBoardgameRating,
  calculateBookRating,
  saveRating,
  getRating,
};

export default contentRating;
