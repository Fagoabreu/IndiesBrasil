import { ActionList } from "@primer/react";
import { useRouter } from "next/router";

export default function LeftSidebarComponent() {
  const router = useRouter();

  return (
    <ActionList>
      <ActionList.Item onSelect={() => router.push("/")}>Home</ActionList.Item>
      <ActionList.Item onSelect={() => router.push("/posts")}>Posts</ActionList.Item>
      <ActionList.Item onSelect={() => router.push("/membros")}>Membros</ActionList.Item>
    </ActionList>
  );
}
