import { ActionList, Stack } from "@primer/react";

function LeftSidebarComponent() {
  return (
    <Stack.Item sx={{ flex: { narrow: "1 1 100%", regular: "0 0 250px" }, display: { narrow: "none", regular: "flex" }, overflowY: "auto", maxHeight: "calc(100vh - 80px)" }}>
      <ActionList>
        <ActionList.Item>Feed</ActionList.Item>
        <ActionList.Item>Eventos</ActionList.Item>
        <ActionList.Item>Portfólios</ActionList.Item>
        <ActionList.Item>Comunidades</ActionList.Item>
      </ActionList>
    </Stack.Item>
  );
}
export default LeftSidebarComponent;
