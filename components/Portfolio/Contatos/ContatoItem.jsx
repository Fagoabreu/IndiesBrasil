import { Text } from "@primer/react";
import styles from "./ContatoItem.module.css";
import IconSvg from "@/components/IconSvg/IconSvg";

export default function ContatoItem({ item }) {
  return (
    <div className={styles.item}>
      <IconSvg src={`/images/contacts/${item.icon_img}.svg`} alt={item.icon_key} />
      <Text size="medium">{item.contact_value}</Text>
    </div>
  );
}
