import { Stack, Text } from "@primer/react";
import UserCardComponent from "./UserCardComponent";
import { useEffect, useState } from "react";

export default function WhoToFollow() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await fetch("/api/v1/users?isfollowing=false", {
          credentials: "include",
        });

        const data = await res.json();
        setUsers(
          (data || []).map((u) => ({
            ...u,
            isFollowing: u.isFollowing ?? false,
            followers_count: u.followers_count ?? 0,
          })),
        );
      } catch (error) {
        console.error("Erro ao carregar sugestões:", error);
      }
    }
    loadUsers();
  }, []);

  function handleToggleFollow(username, nowFollowing) {
    setUsers((prev) => prev.map((u) => (u.username === username ? { ...u, isFollowing: nowFollowing, followers_count: u.followers_count + (nowFollowing ? 1 : -1) } : u)).filter((u) => !u.isFollowing));
  }

  if (!users.length) return null;

  return (
    <Stack direction="vertical" gap={3}>
      <Text fontWeight="bold">Sugestões de quem seguir</Text>

      {users.map((u) => (
        <Stack direction="horizontal" gap={2} sx={{ alignItems: "center" }} key={u.username}>
          <UserCardComponent user={u} onToggleFollow={handleToggleFollow} />
        </Stack>
      ))}
    </Stack>
  );
}
