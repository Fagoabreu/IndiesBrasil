import { Text } from "@primer/react";
import styles from "./FerramentaItem.module.css";
import IconSvg from "@/components/IconSvg/IconSvg";

const EXPERIENCE_STARS = {
  Estudante: 1,
  Junior: 2,
  Pleno: 3,
  Senior: 4,
  Especialista: 5,
};

export default function FerramentaItem({ item }) {
  const stars = EXPERIENCE_STARS[item.experience] || 0;

  return (
    <div className={styles.item}>
      {item.icon_img && <IconSvg src={`/images/tools/${item.icon_img}.svg`} alt={item.name} width={20} height={20} />}

      <div className={styles.info}>
        <Text size="medium">{item.name}</Text>

        <div className={styles.stars}>
          {"★".repeat(stars)}
          {"☆".repeat(5 - stars)}
        </div>
      </div>
    </div>
  );
}
