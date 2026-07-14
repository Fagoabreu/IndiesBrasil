"use client";
import { useState } from "react";
import PropTypes from "prop-types";
import styles from "./AddressDisplay.module.css";

/** Formata o CEP no padrão 00000-000 */
function formatZip(raw) {
  const z = raw.replace(/\D/g, "");
  if (z.length !== 8) return z;
  return z.slice(0, 5) + "-" + z.slice(5);
}

/** Monta array de linhas de texto a partir de um objeto address */
function buildAddressLines(addr) {
  const lines = [];
  const streetLine = [addr.street, addr.number].filter(Boolean).join(", ");
  if (streetLine) lines.push(streetLine);
  if (addr.complement) lines.push(addr.complement);
  if (addr.neighborhood) lines.push(addr.neighborhood);
  const cityState = [addr.city, addr.state].filter(Boolean).join(" \u2013 ");
  if (cityState) lines.push(cityState);
  if (addr.zip_code) lines.push("CEP " + formatZip(addr.zip_code));
  if (addr.country && addr.country !== "Brasil") lines.push(addr.country);
  return lines;
}

/**
 * Exibe um endereço estruturado com toggle de mapa do Google Maps.
 * Reutilizável em qualquer feature que tenha um objeto address.
 */
export default function AddressDisplay({ address, locationName, locationUrl }) {
  const [showMap, setShowMap] = useState(false);

  const hasAddress = address && (address.city || address.street);
  const hasAnything = hasAddress || locationName;

  if (!hasAnything) return null;

  const lines = hasAddress ? buildAddressLines(address) : [];

  /* Query para o iframe do Maps: usa endereço completo ou nome do local */
  const mapQuery =
    lines.length > 0 ? lines.slice(0, 4).join(", ") : locationName;

  return (
    <div className={styles.container}>
      {/* Nome do local (venue) */}
      {locationName &&
        (locationUrl ? (
          <a
            href={locationUrl}
            className={styles.venueName}
            target="_blank"
            rel="noopener noreferrer"
          >
            {locationName} ↗
          </a>
        ) : (
          <span className={styles.venueName}>{locationName}</span>
        ))}

      {/* Linhas de endereço estruturado */}
      {lines.length > 0 && (
        <address className={styles.addressBlock}>
          {lines.map((line) => (
            <span key={line} className={styles.addressLine}>
              {line}
            </span>
          ))}
        </address>
      )}

      {/* Botão toggle do mapa */}
      {mapQuery && (
        <button
          type="button"
          className={styles.mapToggle}
          onClick={() => setShowMap((v) => !v)}
        >
          {showMap ? "Ocultar mapa" : "Ver no mapa"}
        </button>
      )}

      {/* Iframe do Google Maps */}
      {showMap && mapQuery && (
        <div className={styles.mapContainer}>
          <iframe
            title="Localização no mapa"
            src={
              "https://maps.google.com/maps?q=" +
              encodeURIComponent(mapQuery) +
              "&output=embed&hl=pt-BR"
            }
            className={styles.mapIframe}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}

AddressDisplay.propTypes = {
  address: PropTypes.shape({
    street: PropTypes.string,
    number: PropTypes.string,
    complement: PropTypes.string,
    neighborhood: PropTypes.string,
    city: PropTypes.string,
    state: PropTypes.string,
    zip_code: PropTypes.string,
    country: PropTypes.string,
  }),
  locationName: PropTypes.string,
  locationUrl: PropTypes.string,
};

AddressDisplay.defaultProps = {
  address: null,
  locationName: null,
  locationUrl: null,
};
