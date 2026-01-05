import { Stack, Text } from "@primer/react";
import { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import UserCardComponent from "./UserCard/UserCardComponent";

export default function WhoToFollow() {
  const { user } = useUser();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await fetch("/api/v1/users?isfollowing=false", {
          credentials: "include",
        });

        const data = await res.json();
        if (res.ok) {
          setUsers(
            (data || []).map((u) => ({
              ...u,
              isFollowing: u.isFollowing ?? false,
              followers_count: u.followers_count ?? 0,
            })),
          );
        }
      } catch (error) {
        console.error("Erro ao carregar sugestões:", error);
      }
    }
    loadUsers();
  }, []);

  async function handleToggleFollow(username, nowFollowing) {
    // snapshot para rollback
    const previousUsers = users;

    // optimistic update
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
        // regra atual: remove da lista quem passou a seguir
        .filter((u) => !u.isFollowing),
    );

    try {
      const res = await fetch(`/api/v1/users/${username}/follow`, {
        method: nowFollowing ? "POST" : "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Erro ao seguir usuário");
      }
    } catch (error) {
      console.error("Erro ao seguir usuário:", error);
      // rollback em caso de erro
      setUsers(previousUsers);
    }
  }

  if (!users.length) return null;

  return (
    <Stack direction="vertical" gap={3}>
      <Text fontWeight="bold">Sugestões de quem seguir</Text>

      {users.map((u) => (
        <Stack direction="horizontal" gap={2} sx={{ alignItems: "center" }} key={u.username}>
          <UserCardComponent user={u} onToggleFollow={handleToggleFollow} canFollow={user} />
        </Stack>
      ))}
    </Stack>
  );
}
