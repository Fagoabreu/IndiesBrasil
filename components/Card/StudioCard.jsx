import Image from "next/image";
import Link from "next/link";
import PropTypes from "prop-types";
import { Avatar } from "@primer/react";
import { PeopleIcon } from "@primer/octicons-react";

import useTiltEffect from "@/hooks/useTiltEffect";
import { serviceChipLabel } from "@/lib/serviceGroups";
import styles from "./StudioCard.module.css";

/**
 * Cartão de estúdio das listagens.
 *
 * Era markup inline de `pages/estudios/index.js`; virou componente quando
 * `/servicos` passou a desenhar o mesmo cartão. A regra do projeto é explícita:
 * o mesmo bloco de JSX em duas telas vira componente — a cópia divergiria no
 * primeiro ajuste de estilo, porque cada página é lida isoladamente.
 *
 * `services` é opcional: `/estudios` já recebe a lista agregada do model e
 * mostra até três chips; um chamador que não mande nada simplesmente não vê
 * chips.
 */
export default function StudioCard({ studio }) {
  const tiltRef = useTiltEffect({
    max: 8,
    perspective: 900,
    scale: 1.02,
    maxGlare: 0.12,
  });

  const services = Array.isArray(studio.services) ? studio.services : [];
  const visibleServices = services.slice(0, 3);
  const extraServices = services.length - visibleServices.length;

  return (
    <li className={styles.studioCard} ref={tiltRef}>
      <Link href={`/estudios/${studio.slug}`} className={styles.cardLink}>
        <div className={styles.cardBanner}>
          {studio.banner_url ? (
            <div style={{ position: "relative", width: "100%", height: "100%" }}>
              <Image
                src={studio.banner_url}
                alt=""
                fill
                className={styles.bannerImg}
                sizes="(max-width: 600px) 100vw, 300px"
                style={{ objectFit: "cover" }}
              />
            </div>
          ) : (
            <div className={styles.bannerPlaceholder} />
          )}
        </div>

        <div className={styles.cardBody}>
          <div className={styles.cardLogoRow}>
            <Avatar src={studio.logo_url || "/images/studio.jpg"} size={48} alt={studio.name} className={styles.studioLogo} />
          </div>

          <h2 className={styles.studioName}>{studio.name}</h2>
          {studio.pitch && <p className={styles.studioPitch}>{studio.pitch}</p>}

          {visibleServices.length > 0 && (
            <div className={styles.serviceChips}>
              {visibleServices.map((service) => (
                <span key={service.slug} className={styles.serviceChip}>
                  {serviceChipLabel(service)}
                </span>
              ))}
              {extraServices > 0 && <span className={styles.serviceChipMore}>+{extraServices}</span>}
            </div>
          )}

          <div className={styles.cardMeta}>
            <span className={styles.metaItem}>
              <PeopleIcon size={13} />
              {studio.member_count ?? 0} {studio.member_count === 1 ? "membro" : "membros"}
            </span>
            {(studio.follower_count ?? 0) > 0 && (
              <span className={styles.metaItem}>
                {studio.follower_count} {studio.follower_count === 1 ? "seguidor" : "seguidores"}
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}

StudioCard.propTypes = {
  studio: PropTypes.shape({
    slug: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    pitch: PropTypes.string,
    logo_url: PropTypes.string,
    banner_url: PropTypes.string,
    member_count: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    follower_count: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    services: PropTypes.arrayOf(
      PropTypes.shape({
        slug: PropTypes.string,
        name: PropTypes.string,
      }),
    ),
  }).isRequired,
};
