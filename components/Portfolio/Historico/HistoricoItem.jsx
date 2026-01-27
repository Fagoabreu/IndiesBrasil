import { Text } from "@primer/react";
import DateUtils from "@/utils/DateUtils";
import style from "./HistoricoItem.module.css";

export default function HistoricoItem({ item }) {
  return (
    <div>
      <div className={style.resumeHeader}>
        <strong>{item.cargo}</strong>
        <Text size="small" className={style.resumeDate}>
          {DateUtils.formatMonthYear(item.init_date)} — {item.end_date ? DateUtils.formatMonthYear(item.end_date) : "Atual"}
        </Text>
      </div>

      <Text size="medium" className={style.resumeSub}>
        {item.company}
        {item.cidade && ` · ${item.cidade}`}
        {item.estado && ` · ${item.estado}`}
      </Text>

      {Array.isArray(item.atribuicoes) && (
        <ul>
          {item.atribuicoes.map((a, i) => (
            <li key={i}>
              <Text size="medium">{a}</Text>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
