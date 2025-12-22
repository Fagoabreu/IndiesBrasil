// components/UserCardComponent.jsx
import { Avatar, Button, Text, Link, Stack } from "@primer/react";
import styles from "./UserCardComponent.module.css";

export default function UserCardComponent({ user, onToggleFollow, canFollow = true }) {
  return (
    <div className={styles.card}>
      {/* Header */}
      <Stack direction="horizontal" gap={3} alignItems="center">
        <Avatar size={64} src={user.avatar_url || "/images/avatar.png"} className={styles.avatar} />

        <div className={styles.headerInfo}>
          <Text as="div" fontWeight="bold" fontSize={2}>
            <Link href={`/perfil/${user.username}`} className={styles.username}>
              {user.name || user.username}
            </Link>
          </Text>

          <Text as="div" fontSize={1} className={styles.subtitle}>
            @{user.username}
          </Text>
        </div>
      </Stack>

      {/* Footer */}
      <div className={styles.footer}>
        <div className={styles.stats}>
          <div>
            <Text fontSize={1} fontWeight="bold">
              {user.posts_count ?? 0}
            </Text>
            <Text fontSize={0} className={styles.statLabel}>
              Posts
            </Text>
          </div>

          <div>
            <Text fontSize={1} fontWeight="bold">
              {user.followers_count ?? 0}
            </Text>
            <Text fontSize={0} className={styles.statLabel}>
              Seguidores
            </Text>
          </div>
        </div>

        {canFollow && (
          <Button size="small" variant={user.isFollowing ? "danger" : "primary"} onClick={() => onToggleFollow(user.username, !user.isFollowing)}>
            {user.isFollowing ? "Seguindo" : "Seguir"}
          </Button>
        )}
      </div>
    </div>
  );
}
