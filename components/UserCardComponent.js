// components/UserCardComponent.jsx
import { Avatar, Button, Text, Link, Stack } from "@primer/react";
import styles from "./UserCardComponent.module.css";

export default function UserCardComponent({ user, onToggleFollow, canFollow = true }) {
  return (
    <div className={styles.cardWrapper}>
      <Stack direction="horizontal" gap={3} sx={{ alignItems: "center" }}>
        <Avatar size={48} src={user.avatar_url || "/images/avatar.png"} className={styles.avatar} />

        <Stack direction="vertical" gap={0} className={styles.info}>
          <Text fontWeight="bold" fontSize={2} as="div">
            <Link href={`/perfil/${user.username}`} className={styles.username}>
              {user.username}
            </Link>
          </Text>

          <Text fontSize={1} className={styles.handle} as="div">
            @{user.username}
          </Text>

          <Text fontSize={0} className={styles.followers} as="div">
            {user.followers_count ?? 0} seguidores
          </Text>
        </Stack>
        {canFollow && (
          <Button size="small" variant={user.isFollowing ? "danger" : "primary"} onClick={() => onToggleFollow(user.username, !user.isFollowing)} className={styles.button}>
            {user.isFollowing ? "Deixar de seguir" : "Seguir"}
          </Button>
        )}
      </Stack>
    </div>
  );
}
