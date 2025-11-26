import { useEffect, useState } from "react";
import { Avatar, Stack, Text } from "@primer/react";
import FollowButton from "./FollowButton";

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

  if (!users.length) return null;

  const handleToggleFollow = (username, nowFollowing) => {
    setUsers((prev) =>
      prev
        .map((u) =>
          u.username === username
            ? {
                ...u,
                isFollowing: nowFollowing,
                followers_count: u.followers_count + (nowFollowing ? 1 : -1),
              }
            : u,
        )
        // Se o usuário começou a seguir, removemos da lista
        .filter((u) => !u.isFollowing),
    );
  };

  return (
    <Stack direction="vertical" gap={3}>
      <Text fontWeight="bold">Sugestões de quem seguir</Text>

      {users.map((u) => (
        <Stack key={u.username} direction="horizontal" gap={2} sx={{ alignItems: "center" }}>
          <Avatar src={u.avatar_url || "/images/avatar.png"} />

          <Stack direction="vertical" gap={0}>
            <Text fontWeight="bold">{u.username}</Text>
            <Text fontSize={0} color="fg.muted">
              @{u.username}
            </Text>
            <Text fontSize={0} color="fg.muted">
              {u.followers_count ?? 0} seguidores
            </Text>
          </Stack>

          <FollowButton username={u.username} isFollowing={u.isFollowing ?? false} onToggle={handleToggleFollow} />
        </Stack>
      ))}
    </Stack>
  );
}
