/**
 * Repara o término dos eventos de dia inteiro gravados pelo cliente defeituoso.
 *
 * ## O defeito
 *
 * O conserto anterior fez o formulário converter o dia escolhido em instante
 * **antes** de enviar. Para o término isso apagava a diferença entre "último dia
 * incluído" (o que o input pede) e "fronteira exclusiva" (o que a API guarda): a
 * meia-noite do dia 22 é a fronteira de término de um evento que **acaba** no dia
 * 21, então o servidor leu exatamente isso e o evento perdeu o último dia. Um
 * evento "20 a 22/11, dia inteiro" ficou gravado como `20/11 03:00Z → 22/11
 * 03:00Z` quando o certo é `→ 23/11 03:00Z`.
 *
 * O estrago é sempre o mesmo, e é reversível: `ends_at` ficou **exatamente um
 * dia** antes do que deveria. Este `UPDATE` soma esse dia de volta em `events` e
 * em `event_instances` (é a tabela que a agenda e a home listam).
 *
 * ## Por que existe um recorte de tempo
 *
 * O valor gravado é uma fronteira legítima: meia-noite de Brasília. Não há nada
 * nele que diga "esta linha está um dia curta" — a informação que se perdeu não
 * está no dado. O único discriminador que existe é **quando** a linha foi
 * escrita: entre o deploy do cliente defeituoso e este conserto, todo evento de
 * dia inteiro salvo ficou um dia curto. Antes disso o cliente antigo gravava
 * `00:00Z` (outra forma, já corrigida pela migration anterior); depois disso o
 * cliente novo grava a fronteira certa.
 *
 * Ou seja: o filtro por `updated_at` não é aproximação, é a fronteira real do
 * defeito. O que ele pode pegar a mais é uma linha escrita nesse intervalo por
 * fora do formulário (um `curl` com a fronteira já correta) — foi aceito em troca
 * de o dado de produção se corrigir sozinho, sem depender de alguém reabrir cada
 * evento e digitar o dia de novo.
 *
 * ## Assinatura das linhas afetadas
 *
 * `starts_at` **e** `ends_at` na meia-noite de Brasília (03:00Z). É a forma que
 * só os clientes novo e defeituoso produzem — o antigo gravava meia-noite UTC,
 * que em Brasília é 21h do dia anterior e não casa aqui. A checagem de
 * `starts_at` existe para não tocar linha de forma nenhuma outra (o evento pode
 * ter hora, e aí `is_all_day` conviveria com horários de parede arbitrários).
 *
 * ## Idempotência
 *
 * Não é idempotente por natureza (somar um dia a uma fronteira dá outra
 * fronteira válida), então ela depende de rodar uma única vez — o que o
 * `pgmigrations` garante. O `exports.down` subtrai o mesmo dia no mesmo recorte.
 */

/** Commit do cliente defeituoso (`673ffcc`), 12/10/2026 14:17:19 -03. */
const CLIENTE_DEFEITUOSO_EM = "2026-10-12T17:17:19Z";

const MEIA_NOITE_DE_BRASILIA = (coluna) =>
  `(${coluna} AT TIME ZONE 'America/Sao_Paulo') = date_trunc('day', ${coluna} AT TIME ZONE 'America/Sao_Paulo')`;

exports.up = (pgm) => {
  pgm.sql(`
    UPDATE events
       SET ends_at = ends_at + interval '1 day'
     WHERE is_all_day
       AND updated_at >= '${CLIENTE_DEFEITUOSO_EM}'
       AND ${MEIA_NOITE_DE_BRASILIA("ends_at")}
       AND ${MEIA_NOITE_DE_BRASILIA("starts_at")};
  `);

  // A agenda e a home leem `event_instances`: corrigir só `events` deixaria o
  // card com o dia errado, que é justamente o sintoma relatado.
  pgm.sql(`
    UPDATE event_instances AS ei
       SET ends_at = ei.ends_at + interval '1 day'
      FROM events AS e
     WHERE e.id = ei.event_id
       AND e.is_all_day
       AND e.updated_at >= '${CLIENTE_DEFEITUOSO_EM}'
       AND ${MEIA_NOITE_DE_BRASILIA("ei.ends_at")}
       AND ${MEIA_NOITE_DE_BRASILIA("ei.starts_at")};
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    UPDATE events
       SET ends_at = ends_at - interval '1 day'
     WHERE is_all_day
       AND updated_at >= '${CLIENTE_DEFEITUOSO_EM}'
       AND ${MEIA_NOITE_DE_BRASILIA("ends_at")}
       AND ${MEIA_NOITE_DE_BRASILIA("starts_at")};
  `);

  pgm.sql(`
    UPDATE event_instances AS ei
       SET ends_at = ei.ends_at - interval '1 day'
      FROM events AS e
     WHERE e.id = ei.event_id
       AND e.is_all_day
       AND e.updated_at >= '${CLIENTE_DEFEITUOSO_EM}'
       AND ${MEIA_NOITE_DE_BRASILIA("ei.ends_at")}
       AND ${MEIA_NOITE_DE_BRASILIA("ei.starts_at")};
  `);
};
