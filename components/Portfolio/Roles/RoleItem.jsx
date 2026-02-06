import { Text, Avatar } from "@primer/react";
import styles from "./RoleItem.module.css";
import IconSvg from "@/components/IconSvg/IconSvg";

const EXPERIENCE_LABELS = {
  estudante: "⭐ Estudante",
  junior: "⭐⭐ Junior",
  pleno: "⭐⭐⭐ Pleno",
  senior: "⭐⭐⭐⭐ Senior",
  especialista: "⭐⭐⭐⭐⭐ Especialista",
};

export default function RoleItem({ item }) {
  if (!item) return null;

  const experienceKey = item.experience?.toLowerCase();

  return (
    <div className={styles.roleItem}>
      {item.icon_img && <IconSvg src={`/images/professions/${item.icon_img}.png`} alt={item.name} width={20} height={20} />}

      <div className={styles.roleInfo}>
        <Text weight="bold">{item.portfolio_role_name}</Text>
        <Text size="small" color="fg.muted">
          {EXPERIENCE_LABELS[experienceKey] || "Nível não informado"}
        </Text>
      </div>
    </div>
  );
}
