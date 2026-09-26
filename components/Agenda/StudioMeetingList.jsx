import { useEffect, useState } from "react";
import Link from "next/link";
import PropTypes from "prop-types";
import { LockIcon, BroadcastIcon } from "@primer/octicons-react";
import { EVENT_MONTHS_SHORT, eventDateParts } from "@/lib/eventFormat";
import { formatMeetingRange, getMeetingPhase } from "@/lib/meetingFormat";
import styles from "./StudioMeetingList.module.css";

/**
 * Bloco de reuniões dos estúdios do usuário, exibido na agenda.
 *
 * Fica em bloco próprio (e não na mesma lista dos eventos) porque é conteúdo
 * **privado**: a agenda é pública e indexável, e uma reunião de estúdio só
 * existe para quem participa. Na mesma lista a diferença ficaria invisível — e
 * o `EventCard` oferece compartilhar, que não faz sentido para uma reunião
 * interna.
 *
 * O destino do clique é a página de reuniões do estúdio, não `/reunioes/<id>`:
 * aquela é a entrada de convidado externo, que pede código de acesso.
 *
 * Só lista reuniões com que ainda dá para interagir (agendadas ou ao vivo):
 * uma reunião encerrada não tem ação possível, e o clique levaria a uma sala
 * fechada.
 */
export default function StudioMeetingList({ meetings }) {
  // "Agora" atualizado periodicamente: o selo "Ao vivo" precisa mudar sem
  // recarregar a página, e ler `Date.now()` direto no render tornaria o render
  // impuro (mesmo recurso do `MeetingCard`).
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  if (!meetings?.length) return null;

  // Só fases com que ainda dá para interagir. O SQL já exclui as encerradas,
  // mas a lista é buscada uma vez por mês: sem este corte, uma reunião que
  // termina com a aba aberta continuaria na tela até o próximo fetch. O ticker
  // acima já re-renderiza a cada 30s, então aqui o filtro vale a cada tique.
  // Lista de permissão (em vez de negar "ended") para que uma fase nova não
  // apareça por descuido.
  const active = meetings.filter((meeting) => {
    const phase = getMeetingPhase(meeting, nowMs);
    return phase === "scheduled" || phase === "live";
  });

  if (!active.length) return null;

  return (
    <section className={styles.block}>
      <header className={styles.head}>
        <h2 className={styles.title}>
          <LockIcon size={14} /> Reuniões dos seus estúdios
        </h2>
        <p className={styles.hint}>Visível apenas para quem participa do estúdio.</p>
      </header>

      <ul className={styles.list}>
        {active.map((m) => {
          // `eventDateParts` traz dia/mês no fuso de Brasília — o mesmo que o
          // `formatMeetingRange` usa no horário, então o selo de data e a faixa
          // de horário não discordam (era o defeito da lista de eventos).
          const { day, month } = eventDateParts(m.starts_at);

          return (
            <li key={m.id}>
              <Link href={`/estudios/${m.org_slug}/reunioes`} className={styles.item}>
                <div className={styles.dateBadge}>
                  <span className={styles.dateDay}>{day}</span>
                  <span className={styles.dateMonth}>{EVENT_MONTHS_SHORT[month]}</span>
                </div>

                <div className={styles.body}>
                  <div className={styles.top}>
                    <span className={styles.orgBadge}>{m.org_name}</span>
                    {getMeetingPhase(m, nowMs) === "live" && (
                      <span className={styles.liveBadge}>
                        <BroadcastIcon size={12} /> Ao vivo
                      </span>
                    )}
                  </div>
                  <h3 className={styles.itemTitle}>{m.title}</h3>
                  <p className={styles.meta}>{formatMeetingRange(m.starts_at, m.ends_at)}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

StudioMeetingList.propTypes = {
  /** Reuniões como `/api/v1/meetings/mine` entrega. */
  meetings: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      org_slug: PropTypes.string.isRequired,
      org_name: PropTypes.string,
      starts_at: PropTypes.string.isRequired,
      ends_at: PropTypes.string.isRequired,
      status: PropTypes.string,
    }),
  ),
};
