import { useEffect, useState } from "react";
import { Avatar, Stack, Text, Button } from "@primer/react";

export default function WhoToFollow() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/v1/users/random"); // endpoint fictício
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
          <Avatar src={u.avatarUrl || "/avatar.png"} />
          <Stack direction="vertical" gap={0}>
            <Text fontWeight="bold">{u.name}</Text>
            <Text color="fg.muted" fontSize={0}>
              @{u.username}
            </Text>
          </Stack>
          <Button sx={{ marginLeft: "auto" }}>Seguir</Button>
        </Stack>
      ))}
    </Stack>
  );
}
