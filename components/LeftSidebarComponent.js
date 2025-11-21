import { ActionList, Stack } from "@primer/react";
import { useRouter } from "next/router";

function LeftSidebarComponent() {
  const router = useRouter();

  return (
    <Stack.Item sx={{ flex: { narrow: "1 1 100%", regular: "0 0 250px" }, display: { narrow: "none", regular: "flex" }, overflowY: "auto", maxHeight: "calc(100vh - 80px)" }}>
      <ActionList>
        <ActionList.Item onClick={() => router.push("/")}>Home</ActionList.Item>
        <ActionList.Item onClick={() => router.push("/posts")}>Posts</ActionList.Item>
      </ActionList>
    </Stack.Item>
  );
}
export default LeftSidebarComponent;
