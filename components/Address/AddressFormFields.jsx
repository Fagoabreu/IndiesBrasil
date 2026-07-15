"use client";
import { useState } from "react";
import PropTypes from "prop-types";
import styles from "./AddressFormFields.module.css";

const BR_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

/**
 * Campos de endereço reutilizáveis com busca automática de CEP via ViaCEP.
 *
 * Props:
 *   value    — { street, number, complement, neighborhood, city, state, zip_code, country }
 *   onChange — (field: string, value: string) => void
 *   disabled — boolean (opcional)
 */
export default function AddressFormFields({ value, onChange, disabled = false }) {
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");

  async function handleCepLookup() {
    const digits = (value.zip_code || "").replace(/\D/g, "");
    if (digits.length !== 8) {
      setCepError("CEP deve ter 8 dígitos.");
      return;
    }
    setCepError("");
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) {
        setCepError("CEP não encontrado.");
        return;
      }
      onChange("street", data.logradouro || "");
      onChange("neighborhood", data.bairro || "");
      onChange("city", data.localidade || "");
      onChange("state", data.uf || "");
    } catch {
      setCepError("Erro ao buscar CEP. Tente novamente.");
    } finally {
      setCepLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      {/* CEP + busca */}
      <div className={styles.cepRow}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="addr_zip_code">
            CEP
          </label>
          <input
            id="addr_zip_code"
            type="text"
            className={styles.input}
            value={value.zip_code || ""}
            onChange={(e) => onChange("zip_code", e.target.value)}
            placeholder="00000-000"
            maxLength={9}
            disabled={disabled}
          />
        </div>
        <button type="button" className={styles.cepBtn} onClick={handleCepLookup} disabled={disabled || cepLoading}>
          {cepLoading ? "Buscando…" : "Buscar CEP"}
        </button>
      </div>
      {cepError && <span className={styles.cepError}>{cepError}</span>}

      {/* Rua + Número */}
      <div className={styles.streetRow}>
        <div className={`${styles.field} ${styles.streetField}`}>
          <label className={styles.label} htmlFor="addr_street">
            Rua / Avenida
          </label>
          <input
            id="addr_street"
            type="text"
            className={styles.input}
            value={value.street || ""}
            onChange={(e) => onChange("street", e.target.value)}
            placeholder="Rua das Flores"
            maxLength={255}
            disabled={disabled}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="addr_number">
            Número
          </label>
          <input
            id="addr_number"
            type="text"
            className={styles.input}
            value={value.number || ""}
            onChange={(e) => onChange("number", e.target.value)}
            placeholder="100"
            maxLength={20}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Complemento */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="addr_complement">
          Complemento
        </label>
        <input
          id="addr_complement"
          type="text"
          className={styles.input}
          value={value.complement || ""}
          onChange={(e) => onChange("complement", e.target.value)}
          placeholder="Sala 201, 2º andar, Bloco B…"
          maxLength={100}
          disabled={disabled}
        />
      </div>

      {/* Bairro + Cidade + UF */}
      <div className={styles.cityRow}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="addr_neighborhood">
            Bairro
          </label>
          <input
            id="addr_neighborhood"
            type="text"
            className={styles.input}
            value={value.neighborhood || ""}
            onChange={(e) => onChange("neighborhood", e.target.value)}
            placeholder="Centro"
            maxLength={100}
            disabled={disabled}
          />
        </div>
        <div className={`${styles.field} ${styles.cityField}`}>
          <label className={styles.label} htmlFor="addr_city">
            Cidade <span className={styles.required}>*</span>
          </label>
          <input
            id="addr_city"
            type="text"
            className={styles.input}
            value={value.city || ""}
            onChange={(e) => onChange("city", e.target.value)}
            placeholder="São Paulo"
            maxLength={100}
            disabled={disabled}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="addr_state">
            UF <span className={styles.required}>*</span>
          </label>
          <select
            id="addr_state"
            className={styles.select}
            value={value.state || ""}
            onChange={(e) => onChange("state", e.target.value)}
            disabled={disabled}
          >
            <option value="">--</option>
            {BR_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

AddressFormFields.propTypes = {
  value: PropTypes.shape({
    street: PropTypes.string,
    number: PropTypes.string,
    complement: PropTypes.string,
    neighborhood: PropTypes.string,
    city: PropTypes.string,
    state: PropTypes.string,
    zip_code: PropTypes.string,
    country: PropTypes.string,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

AddressFormFields.defaultProps = {
  disabled: false,
};
