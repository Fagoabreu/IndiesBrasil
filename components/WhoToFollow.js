import { useEffect, useState } from "react";
import { Avatar, Stack, Text } from "@primer/react";
import FollowButton from "./FollowButton";

export default function WhoToFollow() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/v1/users?isfollowing=false", {
          credentials: "include", // Envia session_id do cookie
        });

        const data = await res.json();
        setUsers(data || []);
      } catch (err) {
        console.error("Erro ao buscar sugestões:", err);
      }
    }

    fetchUsers();
  }, []);

  if (!users.length) return null;

  return (
    <Stack direction="vertical" gap={3}>
      <Text fontWeight="bold">Sugestões de quem seguir</Text>

      {users.map((u) => (
        <Stack key={u.id} direction="horizontal" gap={2} sx={{ alignItems: "center" }}>
          <Avatar src={u.avatar_url || "/images/avatar.png"} />

          <Stack direction="vertical" gap={0}>
            <Text fontWeight="bold">{u.username}</Text>
            <Text fontSize={0} color="fg.muted">
              @{u.username}
            </Text>
          </Stack>

          <FollowButton userId={u.id} onFollow={(id) => setUsers((prev) => prev.filter((user) => user.id !== id))} />
        </Stack>
      ))}
    </Stack>
  );
}
