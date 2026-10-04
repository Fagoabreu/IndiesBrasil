/**
 * Conserta usernames que a URL nunca consegue alcançar.
 *
 * ## O defeito
 *
 * A coluna `users.username` não tinha validação de formato em nenhuma camada
 * (o formulário checava só o tamanho mínimo; o model, só a unicidade), então
 * aceitou **espaço nas pontas** e **caracteres invisíveis**. Como a busca do
 * perfil compara os bytes (`LOWER(username) = LOWER($1)`), o nome gravado como
 * `"Yuri d Ávila "` nunca casa com a URL que se digita ou compartilha,
 * `/perfil/Yuri%20d%20%C3%81vila` — o perfil responde 404.
 *
 * Em produção isso atingia 5 dos 36 usuários. Um deles era literalmente
 * `B` + seis **hífens suaves** (U+00AD) + `...`, um nome que ninguém consegue
 * reproduzir digitando, porque o hífen suave não aparece na tela.
 *
 * ## O que esta migration aplica
 *
 * A forma canônica de `lib/username.js`, na mesma ordem:
 *
 * 1. remove caracteres invisíveis (hífen suave, largura zero);
 * 2. normaliza para **NFC** — a forma que a URL carrega em `%C3%81`;
 * 3. troca espaços "exóticos" (NBSP, espaço estreito, tab) por espaço comum;
 * 4. colapsa espaços repetidos;
 * 5. apara as pontas.
 *
 * Feito em SQL (e não em JS) por ser uma migration de dados: o `normalize()` é
 * nativo do PostgreSQL 13+ e mantém a transformação inteira no banco, sem
 * trazer a tabela para a memória do processo de migração.
 *
 * ## Por que não dá para desfazer
 *
 * O `down` é vazio de propósito. O valor anterior era exatamente o defeito, e
 * recriá-lo (reaplicar os hífens suaves, o espaço no fim) deixaria os perfis
 * inalcançáveis de novo. Reverter código é possível; reverter isto não faria
 * sentido, e é melhor um `down` explícito e vazio do que um que "funciona".
 */
exports.up = async (pgm) => {
  // Forma canônica, usada tanto para checar colisão quanto para gravar.
  // `UESCAPE '!'` evita a barra invertida, que precisaria ser escapada de novo
  // dentro do template JS.
  const CANONICAL = `
    btrim(
      regexp_replace(
        normalize(
          translate(
            username,
            chr(173) || chr(8203) || chr(8204) || chr(8205) || chr(8288) || chr(65279) || chr(6158),
            ''
          ),
          NFC
        ),
        U&'[!0020!00A0!1680!2000-!200A!202F!205F!3000!0009!000A!000D]+' UESCAPE '!',
        ' ',
        'g'
      )
    )
  `;

  // Colisão: dois nomes diferentes que virariam o mesmo depois de normalizar.
  // A comparação usa `lower` porque a aplicação trata `Yuri` e `yuri` como o
  // mesmo nome (a validação de unicidade é case-insensitive), embora o índice
  // do banco seja case-sensitive.
  //
  // Falhar aqui é o comportamento correto: sem esta checagem, o `UPDATE`
  // estouraria a constraint única e o erro não diria qual nome causou o quê.
  pgm.sql(`
    DO $$
    DECLARE
      conflito RECORD;
    BEGIN
      SELECT lower(${CANONICAL}) AS canonico, array_agg(username) AS nomes
      INTO conflito
      FROM users
      GROUP BY lower(${CANONICAL})
      HAVING count(*) > 1
      LIMIT 1;

      IF FOUND THEN
        RAISE EXCEPTION 'Nao e possivel normalizar os usernames: os nomes % virariam o mesmo valor. Renomeie um deles antes de rodar esta migration.',
          conflito.nomes;
      END IF;
    END $$;
  `);

  // Grava a forma canônica apenas onde ela difere. A condição `<> ''` protege
  // contra um nome composto só de espaços/invisíveis: gravar vazio criaria uma
  // conta sem nome, e o `CHECK`/`NOT NULL` não pegaria isso (string vazia não é
  // nula). Nenhum caso desses existe em produção.
  pgm.sql(`
    UPDATE users
    SET username = ${CANONICAL}
    WHERE username <> ${CANONICAL}
      AND ${CANONICAL} <> '';
  `);
};

// Ver o comentário do cabeçalho: o estado anterior é o defeito, então não há o
// que restaurar.
exports.down = () => {};
