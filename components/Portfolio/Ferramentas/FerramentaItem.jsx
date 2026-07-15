import { Text } from "@primer/react";
import styles from "./FerramentaItem.module.css";
import IconSvg from "@/components/IconSvg/IconSvg";

const EXPERIENCE_STARS = {
  estudante: "⭐ Estudante",
  junior: "⭐⭐ Junior",
  pleno: "⭐⭐⭐ Pleno",
  senior: "⭐⭐⭐⭐ Senior",
  especialista: "⭐⭐⭐⭐⭐ Especialista",
};

export default function FerramentaItem({ item }) {
  if (!item) return null;

  const experienceKey = item.experience?.toLowerCase();

  return (
    <div className={styles.item}>
      {item.icon_img && <IconSvg src={`/images/tools/${item.icon_img}.svg`} alt={item.name} width={20} height={20} />}

      <div className={styles.info}>
        <Text size="medium">{item.name}</Text>
        <Text size="small" color="fg.muted">
          {EXPERIENCE_STARS[experienceKey] || "Nível não informado"}
        </Text>
      </div>
    </div>
  );
}
