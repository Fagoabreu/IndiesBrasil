import PropTypes from "prop-types";
import { MAX_ASSET_CATEGORIES, groupAssetCategories } from "@/lib/assetGroups";
import styles from "./AssetEditor.module.css";

/**
 * Seletor de categorias do asset.
 *
 * Agrupado pelos seis grupos fixos (`lib/assetGroups.js`). Categoria inativa
 * aparece marcada — ela não pode ser escolhida de novo, mas pode ser mantida se
 * o asset já a tinha (caso contrário, salvar o formulário apagaria a
 * classificação sem ninguém pedir).
 */
export default function AssetCategoryPicker({ categories, selected, onChange, disabled = false }) {
  const groups = groupAssetCategories(categories);

  function toggle(categoryId) {
    const already = selected.includes(categoryId);

    if (already) {
      onChange(selected.filter((id) => id !== categoryId));
      return;
    }

    if (selected.length >= MAX_ASSET_CATEGORIES) return;

    onChange([...selected, categoryId]);
  }

  return (
    <fieldset className={styles.categoryFieldset} disabled={disabled}>
      <legend className={styles.label}>
        Categorias <span className={styles.required}>*</span>
      </legend>
      <p className={styles.hint}>
        Selecione de 1 a {MAX_ASSET_CATEGORIES} categorias. Um asset pode pertencer a mais de uma — um pacote com sprites e efeitos
        sonoros, por exemplo.
      </p>

      {groups.map((group) => (
        <div key={group.key} className={styles.categoryGroup}>
          <p className={styles.categoryGroupTitle}>{group.label}</p>
          <div className={styles.categoryOptions}>
            {group.categories.map((category) => {
              const checked = selected.includes(category.id);
              const blocked = !category.is_active && !checked;

              return (
                <label
                  key={category.id}
                  className={`${styles.categoryOption} ${!category.is_active ? styles.categoryInactive : ""}`}
                  title={blocked ? "Categoria desativada — não pode ser escolhida para novos assets." : category.description || undefined}
                >
                  <input type="checkbox" checked={checked} disabled={blocked || disabled} onChange={() => toggle(category.id)} />
                  <span>{category.name}</span>
                  {!category.is_active && <span className={styles.inactiveTag}>inativa</span>}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </fieldset>
  );
}

AssetCategoryPicker.propTypes = {
  categories: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      name: PropTypes.string.isRequired,
      description: PropTypes.string,
      group_key: PropTypes.string.isRequired,
      display_order: PropTypes.number,
      is_active: PropTypes.bool,
    }),
  ).isRequired,
  selected: PropTypes.arrayOf(PropTypes.number).isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};
