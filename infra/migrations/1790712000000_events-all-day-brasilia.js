/**
 * Eventos de dia inteiro: da meia-noite UTC para a meia-noite de Brasília.
 *
 * O formulário gravava o valor de `<input type="date">` com `new Date(...)`, e a
 * especificação manda ler string só de data como **meia-noite UTC**. Um evento
 * "12 de outubro, dia inteiro" ficava em `2026-10-12 00:00Z`, que em Brasília é
 * 21h do dia **11** — o dia anterior aparecia no card da agenda e da home.
 *
 * A conversão daqui é a mesma que o model passou a fazer (`lib/eventFormat.js`):
 * o início vira `00:00` de Brasília do dia escolhido e o término vira `00:00` de
 * Brasília do dia **seguinte** ao último dia escolhido — fim exclusivo, como no
 * RFC 5545 e na API do Google Calendar.
 *
 * ## De onde sai "o dia que o usuário escolheu"
 *
 * Da própria data corrompida, lida em **UTC**: `00:00Z` do dia 12 é literalmente
 * o dia 12 que estava no formulário. É por isso que `AT TIME ZONE 'UTC'` aparece
 * no `SELECT` — ler em Brasília devolveria o dia 11 e o defeito seria apenas
 * transportado.
 *
 * ## Idempotência
 *
 * O filtro exige início exatamente à meia-noite UTC, que é a assinatura do
 * escritor antigo. Rodar de novo não move nada (o valor novo é `03:00Z`), e
 * evento de dia inteiro já correto fica intacto. Sem `date_trunc('day', ts)`
 * direto sobre a coluna: ele depende do `TimeZone` da sessão, então com o banco
 * em outro fuso a migration seria um no-op silencioso — a comparação é entre
 * `timestamp` (já convertidos), onde não há fuso em jogo.
 *
 * Limite conhecido: evento **com hora** criado fora do Brasil gravou a hora de
 * parede do editor lida no fuso dele. Isso não tem assinatura para detectar, e
 * não é o defeito corrigido aqui.
 */

/** Só as linhas gravadas pelo escritor antigo: dia inteiro às 00:00Z em ponto. */
const LEGACY_ALL_DAY_FILTER = `
  is_all_day
  AND (starts_at AT TIME ZONE 'UTC') = date_trunc('day', starts_at AT TIME ZONE 'UTC')
`;

/** Dia civil que o usuário escolheu, recuperado do valor corrompido. */
const ESCOLHIDO_EM_UTC = `
  (starts_at AT TIME ZONE 'UTC')::date AS primeiro_dia,
  (ends_at   AT TIME ZONE 'UTC')::date AS ultimo_dia
`;

exports.up = (pgm) => {
  pgm.sql(`
    UPDATE events AS e
       SET starts_at = (alvo.primeiro_dia::timestamp AT TIME ZONE 'America/Sao_Paulo'),
           ends_at   = ((alvo.ultimo_dia + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
      FROM (
        SELECT id, ${ESCOLHIDO_EM_UTC}
          FROM events
         WHERE ${LEGACY_ALL_DAY_FILTER}
      ) AS alvo
     WHERE e.id = alvo.id;
  `);

  // As instâncias materializadas são o que a agenda e a home listam, e foram
  // gravadas com os mesmos valores — corrigir só `events` deixaria o card no dia
  // antigo.
  pgm.sql(`
    UPDATE event_instances AS ei
       SET starts_at = (alvo.primeiro_dia::timestamp AT TIME ZONE 'America/Sao_Paulo'),
           ends_at   = ((alvo.ultimo_dia + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
      FROM (
        SELECT ei.id,
               (ei.starts_at AT TIME ZONE 'UTC')::date AS primeiro_dia,
               (ei.ends_at   AT TIME ZONE 'UTC')::date AS ultimo_dia
          FROM event_instances ei
          INNER JOIN events e ON e.id = ei.event_id
         WHERE e.is_all_day
           AND (ei.starts_at AT TIME ZONE 'UTC') = date_trunc('day', ei.starts_at AT TIME ZONE 'UTC')
      ) AS alvo
     WHERE ei.id = alvo.id;
  `);
};

exports.down = (pgm) => {
  // Volta a meia-noite UTC do dia escolhido — a forma que o escritor antigo
  // produzia, para que o código anterior continue lendo o mesmo dia.
  pgm.sql(`
    UPDATE events AS e
       SET starts_at = (alvo.primeiro_dia::timestamp AT TIME ZONE 'UTC'),
           ends_at   = (alvo.ultimo_dia::timestamp AT TIME ZONE 'UTC')
      FROM (
        SELECT id,
               (starts_at AT TIME ZONE 'America/Sao_Paulo')::date AS primeiro_dia,
               ((ends_at AT TIME ZONE 'America/Sao_Paulo')::date - 1) AS ultimo_dia
          FROM events
         WHERE is_all_day
           AND (starts_at AT TIME ZONE 'America/Sao_Paulo') = date_trunc('day', starts_at AT TIME ZONE 'America/Sao_Paulo')
      ) AS alvo
     WHERE e.id = alvo.id;
  `);

  pgm.sql(`
    UPDATE event_instances AS ei
       SET starts_at = (alvo.primeiro_dia::timestamp AT TIME ZONE 'UTC'),
           ends_at   = (alvo.ultimo_dia::timestamp AT TIME ZONE 'UTC')
      FROM (
        SELECT ei.id,
               (ei.starts_at AT TIME ZONE 'America/Sao_Paulo')::date AS primeiro_dia,
               ((ei.ends_at AT TIME ZONE 'America/Sao_Paulo')::date - 1) AS ultimo_dia
          FROM event_instances ei
          INNER JOIN events e ON e.id = ei.event_id
         WHERE e.is_all_day
           AND (ei.starts_at AT TIME ZONE 'America/Sao_Paulo') = date_trunc('day', ei.starts_at AT TIME ZONE 'America/Sao_Paulo')
      ) AS alvo
     WHERE ei.id = alvo.id;
  `);
};
