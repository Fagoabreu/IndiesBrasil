import { Text } from "@primer/react";
import { StarFillIcon } from "@primer/octicons-react";
import styles from "./StarExperienceSelector.module.css";

const LEVELS = ["Estudante", "Junior", "Pleno", "Senior", "Especialista"];

export default function StarExperienceSelector({ value, onChange }) {
  const activeIndex = Math.max(
    0,
    LEVELS.findIndex((l) => l.toLowerCase() === value?.toLowerCase()),
  );

  return (
    <div className={styles.container}>
      <div className={styles.stars}>
        {LEVELS.map((_, index) => (
          <button key={index} type="button" className={styles.starButton} onClick={() => onChange?.(LEVELS[index])} aria-label={LEVELS[index]}>
            <StarFillIcon size={20} className={index <= activeIndex ? styles.starActive : styles.starInactive} />
          </button>
        ))}
      </div>

      <Text size="small" className={styles.label}>
        {LEVELS[activeIndex]}
      </Text>
    </div>
  );
}
