import PropTypes from "prop-types";
import Link from "next/link";
import styles from "./AssetCategoryChips.module.css";

/**
 * Chips de categoria de asset.
 *
 * Ponto único de exibição: o card, a página do asset e o estúdio precisam
 * mostrar as categorias do mesmo jeito. `as="span"` é obrigatório dentro do
 * card, que já é um `<a>` — link dentro de link é HTML inválido e o navegador
 * reescreve a árvore.
 */
export default function AssetCategoryChips({ categories = [], limit = null, as = "link", className = "" }) {
  if (!Array.isArray(categories) || categories.length === 0) return null;

  const visible = limit ? categories.slice(0, limit) : categories;
  const hidden = categories.length - visible.length;

  return (
    <ul className={`${styles.list} ${className}`.trim()}>
      {visible.map((category) => (
        <li key={category.slug ?? category.name} className={styles.item}>
          {as === "link" ? (
            <Link href={`/assets?category=${encodeURIComponent(category.slug)}`} className={styles.chip}>
              {category.name}
            </Link>
          ) : (
            <span className={styles.chip}>{category.name}</span>
          )}
        </li>
      ))}
      {hidden > 0 && (
        <li className={styles.item}>
          <span className={styles.more} title={categories.map((category) => category.name).join(", ")}>
            +{hidden}
          </span>
        </li>
      )}
    </ul>
  );
}

AssetCategoryChips.propTypes = {
  categories: PropTypes.arrayOf(
    PropTypes.shape({
      slug: PropTypes.string,
      name: PropTypes.string.isRequired,
      group_key: PropTypes.string,
    }),
  ),
  /** Quantos chips mostrar antes do "+N". Sem limite, mostra todos. */
  limit: PropTypes.number,
  as: PropTypes.oneOf(["link", "span"]),
  className: PropTypes.string,
};
