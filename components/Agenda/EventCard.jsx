import Image from "next/image";
import Link from "next/link";
import PropTypes from "prop-types";
import { LocationIcon, BroadcastIcon, ShareAndroidIcon } from "@primer/octicons-react";
import { eventTypeLabel } from "@/lib/event-types";
import { EVENT_MONTHS_SHORT, eventDateParts, formatEventTimeRange } from "@/lib/eventFormat";
import styles from "./EventCard.module.css";

/**
 * Item de evento da agenda.
 *
 * Era markup da página da agenda; virou componente quando a home passou a
 * mostrar os próximos eventos — as duas telas desenham o mesmo card, e a cópia
 * divergiria no primeiro ajuste (o motivo de a extração ser obrigatória aqui).
 *
 * O botão de compartilhar só aparece quando quem usa passa `onShare`: ele precisa
 * do modal, que é estado da página.
 */
export default function EventCard({ event, onShare }) {
  // Um único cálculo por card: cada `eventDateParts` formata a data inteira.
  const { day, month } = eventDateParts(event.starts_at);

  return (
    <div className={styles.eventItem}>
      <Link href={`/agenda/${event.event_id}`} className={styles.eventCard}>
        {/* Data */}
        <div className={styles.dateBadge}>
          <span className={styles.dateDay}>{day}</span>
          <span className={styles.dateMonth}>{EVENT_MONTHS_SHORT[month]}</span>
        </div>

        {/* Corpo */}
        <div className={styles.eventBody}>
          <div className={styles.eventTop}>
            <span className={`${styles.typeBadge} ${styles[event.event_type]}`}>{eventTypeLabel(event.event_type)}</span>
            {event.visibility === "private" && <span className={styles.privateBadge}>🔒 Privado</span>}
          </div>

          <h2 className={styles.eventTitle}>{event.override_title || event.title}</h2>

          <div className={styles.eventMeta}>
            {!event.is_all_day && <span className={styles.metaItem}>🕐 {formatEventTimeRange(event.starts_at, event.ends_at)}</span>}
            {event.is_online && (
              <span className={styles.onlineBadge}>
                <BroadcastIcon size={12} /> Online
              </span>
            )}
            {!event.is_online && event.location_name && (
              <span className={styles.metaItem}>
                <LocationIcon size={12} /> {event.location_name}
              </span>
            )}
            <span className={styles.metaItem}>por @{event.organizer_username}</span>
          </div>

          {event.rsvp_going > 0 && (
            <span className={styles.rsvpCount}>
              <span className={styles.rsvpCountGoing}>{event.rsvp_going}</span> confirmado{event.rsvp_going === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {/* Banner */}
        {event.banner_url && (
          <div className={styles.eventBanner}>
            <Image src={event.banner_url} alt="" fill className={styles.bannerThumb} sizes="300px" />
          </div>
        )}
      </Link>

      {onShare && (
        <button
          type="button"
          className={styles.shareBtn}
          aria-label={`Compartilhar ${event.override_title || event.title}`}
          onClick={() => onShare(event)}
        >
          <ShareAndroidIcon size={14} />
        </button>
      )}
    </div>
  );
}

EventCard.propTypes = {
  /** Evento como a API entrega (`instance_id`, `event_id`, `starts_at`, ...). */
  event: PropTypes.shape({
    instance_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    event_id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    override_title: PropTypes.string,
    event_type: PropTypes.string.isRequired,
    visibility: PropTypes.string,
    is_online: PropTypes.bool,
    is_all_day: PropTypes.bool,
    starts_at: PropTypes.string.isRequired,
    ends_at: PropTypes.string.isRequired,
    location_name: PropTypes.string,
    banner_url: PropTypes.string,
    organizer_username: PropTypes.string,
    rsvp_going: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }).isRequired,
  /** Quando informado, mostra o botão de compartilhar e entrega o evento. */
  onShare: PropTypes.func,
};
