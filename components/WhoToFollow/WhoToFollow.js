import { Stack, Text } from "@primer/react";
import { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import UserCardComponent from "../UserCard/UserCardComponent";
import styles from "./WhotoFollow.module.css";

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
    if (nowFollowing) {
      setUsers((prev) => prev.filter((u) => u.username !== username));
    }
  }

  if (!users.length) return null;

  return (
    <Stack className={styles.followPanel} direction="vertical" gap={3}>
      <Text className={styles.followTitle} fontWeight="bold">
        Quem seguir
      </Text>

      <Stack
        className={styles.followStack}
        gap="condensed"
        direction="vertical"
        justify="start"
      >
        {users.map((u) => (
          <UserCardComponent
            user={u}
            onToggleFollow={handleToggleFollow}
            canFollow={user}
            key={u.username}
          />
        ))}
      </Stack>
    </Stack>
  );
}
