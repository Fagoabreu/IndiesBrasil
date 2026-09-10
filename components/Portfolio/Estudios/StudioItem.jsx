import Link from "next/link";
import { Avatar, Text } from "@primer/react";
import styles from "./StudioItem.module.css";

/**
 * Item compacto de estúdio no perfil do membro: logo + nome, clicável para a
 * página do estúdio.
 */
export default function StudioItem({ item }) {
  if (!item) return null;

  return (
    <Link href={`/estudios/${item.slug}`} className={styles.item}>
      <Avatar src={item.logo_url || "/images/studio.jpg"} size={32} alt="" className={styles.logo} />
      <Text weight="bold" className={styles.name}>
        {item.name}
      </Text>
    </Link>
  );
}
