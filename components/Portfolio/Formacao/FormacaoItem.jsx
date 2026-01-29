import { Text } from "@primer/react";
import DateUtils from "@/utils/DateUtils";
import styles from "./FormacaoItem.module.css";

export default function FormacaoItem({ item }) {
  return (
    <div>
      <div className={styles.header}>
        <strong>{item.nome}</strong>
        <Text size="small" className={styles.date}>
          {DateUtils.formatMonthYear(item.init_date)} — {item.end_date ? DateUtils.formatMonthYear(item.end_date) : "Atual"}
        </Text>
      </div>

      <Text size="medium" className={styles.sub}>
        {item.instituicao}
      </Text>
    </div>
  );
}
