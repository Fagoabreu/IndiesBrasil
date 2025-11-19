import React from "react";
import { ProgressBar, Stack, Text } from "@primer/react";

export default function TestProgress() {
  return (
    <Stack direction="vertical" gap={2} sx={{ padding: 4 }}>
      <Text>Exemplo de barra de progresso:</Text>
      <ProgressBar progress={50} aria-label="50% concluído" barSize="large" />
    </Stack>
  );
}
