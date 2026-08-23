/**
 * Constantes do sistema de reputação.
 *
 * Separadas do model para evitar que componentes client-side puxem
 * infra/database → pg → módulos Node.js para dentro do bundle do browser.
 *
 * `points`     — pontos aplicados (positivo recompensa, negativo penaliza).
 * `dailyLimit` — limite diário de eventos pontuados por ação; `null` = sem
 *                limite diário (penalidades por denúncia falsa).
 * `label`      — rótulo pt-BR para exibição na interface.
 *
 * A soma é um sinal de confiança/atividade, não de status social. O objetivo
 * é distinguir usuários ativos e confiáveis de usuários abusivos — nunca
 * "gamificar" a rede para prender o usuário.
 */

export const REPUTATION_ACTIONS = {
  post_created: { points: 2, dailyLimit: 5, label: "Post criado" },
  comment_created: { points: 1, dailyLimit: 20, label: "Comentário criado" },
  post_liked: { points: 1, dailyLimit: 50, label: "Post curtido" },
  report_resolved: { points: 10, dailyLimit: null, label: "Denúncia validada" },
  report_dismissed: { points: -5, dailyLimit: null, label: "Denúncia arquivada" },
  studio_created: { points: 15, dailyLimit: null, label: "Estúdio criado" },
  game_created: { points: 8, dailyLimit: 5, label: "Jogo publicado" },
  boardgame_created: { points: 8, dailyLimit: 5, label: "Jogo de mesa publicado" },
  book_created: { points: 8, dailyLimit: 5, label: "Livro publicado" },
  profile_completed: { points: 3, dailyLimit: null, label: "Perfil profissional preenchido" },
};

/**
 * Níveis de confiabilidade derivados da pontuação total.
 *
 * Os níveis não são punitivos: representam o grau de atividade e confiança
 * construído ao longo do tempo. `min` é a pontuação mínima (inclusive) para
 * atingir o nível.
 */
export const REPUTATION_LEVELS = [
  { min: 0, label: "Novato" },
  { min: 15, label: "Membro Ativo" },
  { min: 50, label: "Confiável" },
  { min: 100, label: "Referência" },
];

/**
 * Retorna o nível de confiabilidade correspondente à pontuação informada.
 *
 * @param {number} points pontuação total do usuário.
 * @returns {{ min: number, label: string }} nível correspondente.
 */
export function getReputationLevel(points) {
  const score = Number.isFinite(Number(points)) ? Number(points) : 0;
  let current = REPUTATION_LEVELS[0];
  for (const level of REPUTATION_LEVELS) {
    if (score >= level.min) {
      current = level;
    }
  }
  return current;
}
