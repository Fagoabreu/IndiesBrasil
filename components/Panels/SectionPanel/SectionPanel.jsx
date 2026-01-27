import { Button, Heading, Text } from "@primer/react";
import { PencilIcon } from "@primer/octicons-react";
import style from "./SectionPanel.module.css";

export default function SectionPanel({ title, canEdit, OnEdit, atributes }) {
  return (
    <section className={style.panelFrame}>
      <div className={style.cardHeader}>
        <Heading as="h2" variant="large">
          {title}
        </Heading>

        {canEdit && (
          <Button size="small" variant="primary" onClick={() => OnEdit()}>
            <PencilIcon /> Editar
          </Button>
        )}
      </div>

      {atributes.map((item, index) => (
        <div key={index} className={`${style.resumeItem} ${item.alignment === "row" ? style.row : ""}`}>
          <Heading as="h3" variant="small">
            {item.title}
          </Heading>
          <Text size="medium">{item.content}</Text>
        </div>
      ))}
    </section>
  );
}
