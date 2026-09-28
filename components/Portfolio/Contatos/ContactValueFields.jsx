import { useMemo } from "react";
import { getContactType, detectContactType, toContactKey, serializeContact } from "@/lib/contactTypes";
import ContatoItem from "./ContatoItem";
import styles from "./ContactValueFields.module.css";
import PropTypes from "prop-types";

/**
 * Campos de cadastro de um contato: tipo + valor, com ajuda e prévia.
 *
 * Existe como componente porque os **três** formulários que criam contato
 * (adicionar e editar no perfil, adicionar no estúdio) precisavam das mesmas
 * quatro coisas, e sem extrair cada um faria a sua versão:
 *
 *  1. **placeholder e dica por tipo** — o campo era um `input` genérico com
 *     rótulo "Valor (URL, e-mail, @usuario…)". Ninguém sabia se devia colar o
 *     link, o @usuario ou o número; o registro sabe, então o campo pergunta a
 *     ele;
 *  2. **inferência do tipo pelo que foi colado** — colar
 *     `https://youtube.com/@canal` marca "YouTube" sozinho, o que resolve o
 *     caso mais comum (a pessoa cola primeiro e não mexe no select);
 *  3. **prévia fiel** — renderiza o próprio `ContatoItem` com o valor
 *     digitado, respondendo "como isso vai aparecer no meu perfil?";
 *  4. **validação no cliente** — o erro aparece ao digitar, e não só quando o
 *     servidor recusa o formulário.
 *
 * A validação daqui é conveniência, não segurança: o servidor revalida com o
 * mesmo módulo (`models/contact.resolveValue`).
 *
 * @param {object} props
 * @param {Array<{id: number|string, icon_key: string, icon_img: string}>} props.contactTypes
 * @param {{ contact_type_id: number|string, contact_value: string }} props.value
 * @param {(field: "contact_type_id"|"contact_value", value: string) => void} props.onChange
 * @param {string} props.idPrefix — prefixo dos `id`/`htmlFor` (há mais de um
 *   formulário na mesma página, então ids fixos colidiriam).
 */
export default function ContactValueFields({ contactTypes, value, onChange, idPrefix }) {
  const selected = contactTypes.find((t) => String(t.id) === String(value.contact_type_id));
  const type = getContactType(selected?.icon_key);

  // Só anuncia tipo desconhecido quando o campo já tem conteúdo: enquanto o
  // usuário não digita, "não reconheci" seria um erro inventado.
  const knownKeys = useMemo(() => contactTypes.map((t) => toContactKey(t.icon_key)), [contactTypes]);
  const detected = value.contact_value ? detectContactType(value.contact_value) : null;
  const unrecognized = Boolean(detected) && knownKeys.includes(detected) === false;

  function handleValueChange(raw) {
    onChange("contact_value", raw);

    // A inferência só age quando reconhece o domínio. `@usuario` é ambíguo e
    // NÃO troca o tipo — sobrescrever a escolha do usuário por um chute seria
    // pior que não ajudar.
    const guess = detectContactType(raw);
    if (!guess) return;

    const match = contactTypes.find((t) => toContactKey(t.icon_key) === guess);
    if (match && String(match.id) !== String(value.contact_type_id)) {
      onChange("contact_type_id", String(match.id));
    }
  }

  // Prévia com o mesmo enriquecimento que a API faz — assim o que aparece aqui
  // é exatamente o que vai para a tela depois de salvo.
  const preview = useMemo(
    () =>
      serializeContact({
        contact_value: value.contact_value.trim(),
        icon_key: selected?.icon_key,
        icon_img: selected?.icon_img,
      }),
    [value.contact_value, selected?.icon_key, selected?.icon_img],
  );

  return (
    <>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${idPrefix}-type`}>
          Tipo de contato
        </label>
        <select
          id={`${idPrefix}-type`}
          className={styles.select}
          value={value.contact_type_id ?? ""}
          onChange={(e) => onChange("contact_type_id", e.target.value)}
          required
        >
          <option value="">Selecione…</option>
          {contactTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {getContactType(t.icon_key).label ?? t.icon_key}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${idPrefix}-value`}>
          {type.label ? `Seu ${type.label}` : "Valor do contato"}
        </label>
        <input
          id={`${idPrefix}-value`}
          className={styles.input}
          value={value.contact_value}
          onChange={(e) => handleValueChange(e.target.value)}
          placeholder={type.placeholder}
          // `aria-describedby` liga o campo à dica: quem usa leitor de tela
          // ouve o formato esperado, não só o rótulo.
          aria-describedby={`${idPrefix}-hint`}
          maxLength={255}
          required
        />
        <p id={`${idPrefix}-hint`} className={styles.hint}>
          {type.hint}
        </p>
        {unrecognized && <p className={styles.warning}>Esse link não parece ser de um {getContactType(selected?.icon_key).label ?? "contato"}.</p>}
      </div>

      {value.contact_value.trim() && (
        <div className={styles.preview}>
          <span className={styles.previewLabel}>Como vai aparecer:</span>
          <ContatoItem item={preview} />
        </div>
      )}
    </>
  );
}

ContactValueFields.propTypes = {
  contactTypes: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      icon_key: PropTypes.string,
      icon_img: PropTypes.string,
    }),
  ).isRequired,
  value: PropTypes.shape({
    contact_type_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    contact_value: PropTypes.string,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  idPrefix: PropTypes.string.isRequired,
};
