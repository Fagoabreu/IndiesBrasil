import { Text } from "@primer/react";
import styles from "./ContatoItem.module.css";
import IconSvg from "@/components/IconSvg/IconSvg";

function isUrl(value) {
  return /^https?:\/\//i.test(value);
}

export default function ContatoItem({ item }) {
  const value = item.contact_value;
  const clickable = isUrl(value);

  return (
    <div className={styles.item}>
      <IconSvg src={`/images/contacts/${item.icon_img}.svg`} alt={item.icon_key} />
      {clickable ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className={styles.link}>
          {value}
        </a>
      ) : (
        <Text size="medium">{value}</Text>
      )}
    </div>
  );
}
