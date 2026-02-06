import { ActionMenu, ActionList, Button, Text } from "@primer/react";
import { StarFillIcon } from "@primer/octicons-react";

const EXPERIENCES = [
  { value: "Estudante", stars: 1 },
  { value: "Junior", stars: 2 },
  { value: "Pleno", stars: 3 },
  { value: "Senior", stars: 4 },
  { value: "Especialista", stars: 5 },
];

function Stars({ count }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <StarFillIcon key={i} size={14} style={{ color: "var(--accentColor-fg)" }} />
      ))}
    </>
  );
}

export default function ExperienceSelector({ value, onChange }) {
  const current = EXPERIENCES.find((e) => e.value.toLowerCase() === value?.toLowerCase()) || EXPERIENCES[1]; // fallback Junior

  return (
    <ActionMenu>
      <ActionMenu.Button as={Button} variant="outline">
        <Stars count={current.stars} /> <Text sx={{ ml: 2 }}>{current.value}</Text>
      </ActionMenu.Button>

      <ActionMenu.Overlay>
        <ActionList selectionVariant="single">
          {EXPERIENCES.map((exp) => (
            <ActionList.Item key={exp.value} selected={exp.value.toLowerCase() === value?.toLowerCase()} onSelect={() => onChange?.(exp.value)}>
              <ActionList.LeadingVisual>
                <Stars count={exp.stars} />
              </ActionList.LeadingVisual>
              {exp.value}
            </ActionList.Item>
          ))}
        </ActionList>
      </ActionMenu.Overlay>
    </ActionMenu>
  );
}
