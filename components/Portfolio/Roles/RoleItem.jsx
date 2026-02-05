import { Text, Avatar } from "@primer/react";
import styles from "./RoleItem.module.css";

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
      <Avatar src={item.role_icon_img} size={32} alt={item.role_name} />

      <div className={styles.roleInfo}>
        <Text weight="bold">{item.role_name}</Text>
        <Text size="small" color="fg.muted">
          {EXPERIENCE_LABELS[experienceKey] || "Nível não informado"}
        </Text>
      </div>
    </div>
  );
}
