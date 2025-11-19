import { Heading, Text, Stack } from "@primer/react";

function RightSidebarComponent() {
  return (
    <Stack.Item sx={{ flex: { narrow: "1 1 100%", regular: "0 0 300px" }, display: { narrow: "none", regular: "flex" }, overflowY: "auto", maxHeight: "calc(100vh - 80px)" }}>
      <Stack direction="vertical" sx={{ padding: 3, borderRadius: 6, borderWidth: 1, borderStyle: "solid", borderColor: "border.default", display: "flex" }}>
        <Heading as="h3" sx={{ fontSize: 2, mb: 2 }}>
          Sugestões
        </Heading>
        <Text as="p">Perfis interessantes e comunidades para seguir.</Text>
        <Stack direction="vertical" gap={2} sx={{ mt: 2 }}>
          <Text>@IndieDev123</Text>
          <Text>@RetroGamer</Text>
          <Text>@PixelArtist</Text>
        </Stack>
      </Stack>
    </Stack.Item>
  );
}

export default RightSidebarComponent;
