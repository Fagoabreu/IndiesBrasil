import PropTypes from "prop-types";
import { Spinner } from "@primer/react";
import AssetCategoryPicker from "./AssetCategoryPicker";
import { ASSET_LICENSES } from "@/lib/assetLicenses";
import StatusMessageComponent from "@/components/StatusMessage/StatusMessageComponent";
import styles from "./AssetEditor.module.css";

/**
 * Formulário de edição de um asset já criado.
 *
 * O asset em si não é hospedado aqui: `external_url` é o endereço público onde
 * ele está. A capa é opcional e chega como `children` (o `ImageUploader` fica
 * no `AssetEditor`, que é quem conversa com a API de upload).
 */
export default function AssetForm({ value, onChange, categories, onSubmit, onCancel, saving, message, children }) {
  const selected = Array.isArray(value.category_ids) ? value.category_ids : [];

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <div className={styles.grid}>
        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span className={styles.label}>
            Nome <span className={styles.required}>*</span>
          </span>
          <input
            type="text"
            className={styles.input}
            value={value.name}
            onChange={(event) => onChange("name", event.target.value)}
            maxLength={255}
            required
          />
        </label>

        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span className={styles.label}>
            URL do asset <span className={styles.required}>*</span>
          </span>
          <input
            type="url"
            className={styles.input}
            value={value.external_url}
            onChange={(event) => onChange("external_url", event.target.value)}
            placeholder="https://exemplo.itch.io/pacote-de-sprites"
            maxLength={1024}
            required
          />
          <span className={styles.hint}>O site referencia o asset — o arquivo continua hospedado no endereço acima.</span>
        </label>

        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span className={styles.label}>Tagline</span>
          <input
            type="text"
            className={styles.input}
            value={value.short_description}
            onChange={(event) => onChange("short_description", event.target.value)}
            maxLength={255}
            placeholder="Resumo curto exibido no card"
          />
        </label>

        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span className={styles.label}>Descrição</span>
          <textarea
            className={styles.textarea}
            value={value.description}
            onChange={(event) => onChange("description", event.target.value)}
            rows={5}
            placeholder="O que vem no pacote, para que serve, o que está incluso…"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Origem</span>
          <input
            type="text"
            className={styles.input}
            value={value.source_name}
            onChange={(event) => onChange("source_name", event.target.value)}
            maxLength={60}
            placeholder="itch.io, Kenney, OpenGameArt…"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Créditos</span>
          <input
            type="text"
            className={styles.input}
            value={value.credit}
            onChange={(event) => onChange("credit", event.target.value)}
            maxLength={255}
            placeholder="Autor ou equipe a quem atribuir"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Licença</span>
          <select className={styles.input} value={value.license} onChange={(event) => onChange("license", event.target.value)}>
            {Object.entries(ASSET_LICENSES).map(([key, license]) => (
              <option key={key} value={key}>
                {license.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Formato dos arquivos</span>
          <input
            type="text"
            className={styles.input}
            value={value.file_format}
            onChange={(event) => onChange("file_format", event.target.value)}
            maxLength={120}
            placeholder="PNG, PSD, WAV…"
          />
        </label>

        <div className={`${styles.field} ${styles.checkField}`}>
          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={value.is_free} onChange={(event) => onChange("is_free", event.target.checked)} />
            <span>Distribuição gratuita</span>
          </label>
          <span className={styles.hint}>A loja ainda não está no ar: preço é apenas informativo.</span>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Preço (R$)</span>
          <input
            type="number"
            className={styles.input}
            value={value.price}
            onChange={(event) => onChange("price", event.target.value)}
            min="0"
            step="0.01"
            disabled={value.is_free}
            placeholder={value.is_free ? "Gratuito" : "0,00"}
          />
        </label>

        <div className={`${styles.field} ${styles.fieldWide}`}>
          <span className={styles.label}>Capa (opcional)</span>
          {children}
        </div>
      </div>

      <AssetCategoryPicker categories={categories} selected={selected} onChange={(ids) => onChange("category_ids", ids)} />

      {message?.text && <StatusMessageComponent type={message.type} message={message.text} />}

      <div className={styles.actions}>
        <button type="button" className={styles.btnSecondary} onClick={onCancel} disabled={saving}>
          Fechar
        </button>
        <button type="submit" className={styles.btnPrimary} disabled={saving || !value.name.trim() || !value.external_url.trim()}>
          {saving ? <Spinner size="small" /> : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}

AssetForm.propTypes = {
  value: PropTypes.shape({
    name: PropTypes.string.isRequired,
    external_url: PropTypes.string.isRequired,
    short_description: PropTypes.string,
    description: PropTypes.string,
    source_name: PropTypes.string,
    credit: PropTypes.string,
    license: PropTypes.string,
    is_free: PropTypes.bool,
    price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    file_format: PropTypes.string,
    category_ids: PropTypes.arrayOf(PropTypes.number),
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  categories: PropTypes.array.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  saving: PropTypes.bool,
  message: PropTypes.shape({ type: PropTypes.string, text: PropTypes.string }),
  children: PropTypes.node,
};
