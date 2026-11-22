/**
 * Backfill das features de serviços, sugestões de profissão e gêneros de jogo.
 *
 * `models/activation.js` concede essas features a quem se ativa; esta migration
 * cobre quem já tinha `create:session` antes de cada seção existir — o mesmo
 * padrão de `1790740000001_assets-user-features.js`.
 *
 * ## O defeito que isto corrige
 *
 * As três seções entraram sem backfill. Para uma conta ativada antes delas, o
 * `features` gravado no banco não tem `read:service:all`, e `GET /api/v1/services`
 * responde **403** — o editor de serviços do estúdio não carrega o catálogo e a
 * aba fica vazia. O mesmo vale para o filtro de gêneros de jogo
 * (`GET /api/v1/game-genres`) e para as três filas de sugestão.
 *
 * Não é um caso de borda: qualquer conta criada antes do release perde acesso a
 * uma tela inteira, e o sintoma parece "a página quebrou" — o 403 era invisível
 * enquanto `StatusMessageComponent` ignorava as props `type`/`message`.
 *
 * `create:game_tag` entra junto: criar jogo com tags exige a feature, e quem não
 * a tinha via a tag sumir do formulário.
 */
exports.up = (pgm) => {
  pgm.sql(`
    UPDATE users
    SET features = ARRAY(
      SELECT DISTINCT UNNEST(
        features || ARRAY[
          'read:service',
          'read:service:all',
          'create:service_suggestion',
          'create:profession_suggestion',
          'read:game_genre',
          'read:game_genre:all',
          'create:game_genre_suggestion',
          'create:game_tag'
        ]
      )
    )
    WHERE 'create:session' = ANY(features);
  `);
};

exports.down = false;
