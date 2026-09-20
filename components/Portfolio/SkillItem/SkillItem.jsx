import PropTypes from "prop-types";
import IconSvg from "@/components/IconSvg/IconSvg";
import { experienceLabelWithStars } from "@/lib/experience-levels";
import styles from "./SkillItem.module.css";

/**
 * Item de competência: ícone + nome + nível de experiência.
 *
 * Antes eram dois componentes (`FerramentaItem` e `RoleItem`) com o mesmo
 * desenho, dois CSS Modules quase iguais e dois mapas de estrelas idênticos. A
 * única diferença real era a pasta dos ícones e qual campo guarda o nome — daí
 * `iconSrc` e `label` serem props.
 *
 * @param {string} label   - Nome da ferramenta ou da especialização.
 * @param {string} [level] - Nível de experiência (ex.: "Senior").
 * @param {string} [iconSrc] - Caminho do ícone.
 */
export default function SkillItem({ label, level, iconSrc }) {
  return (
    <div className={styles.item}>
      {iconSrc && <IconSvg src={iconSrc} alt="" />}

      <div className={styles.info}>
        <span className={styles.label}>{label}</span>
        <span className={styles.level}>{experienceLabelWithStars(level)}</span>
      </div>
    </div>
  );
}

SkillItem.propTypes = {
  label: PropTypes.string.isRequired,
  level: PropTypes.string,
  iconSrc: PropTypes.string,
};
