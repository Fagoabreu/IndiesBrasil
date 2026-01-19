import { useUser } from "@/context/UserContext";
import { ActionList } from "@primer/react";
import { useRouter } from "next/router";

export default function LeftSidebarComponent() {
  const router = useRouter();
  const { user } = useUser();

  return (
    <ActionList>
      <ActionList.Item onSelect={() => router.push("/")}>Home</ActionList.Item>
      <ActionList.Item onSelect={() => router.push("/posts")}>Posts</ActionList.Item>
      <ActionList.Item onSelect={() => router.push("/membros")}>Membros</ActionList.Item>
      {user && user.features.includes("read:admin") && <ActionList.Item onSelect={() => router.push("/admin")}>Admin</ActionList.Item>}
    </ActionList>
  );
}
