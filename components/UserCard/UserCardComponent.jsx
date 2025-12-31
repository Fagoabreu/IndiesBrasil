import { Avatar, Button, Text, Link } from "@primer/react";
import styles from "./UserCardComponent.module.css";

export default function UserCardComponent({ user, onToggleFollow, canFollow = true }) {
  return (
    <div className={styles.card}>
      <div className={styles.mainRow}>
        <Avatar size={40} src={user.avatar_image || "/images/avatar.png"} className={styles.avatar} />

        <div className={styles.info}>
          <Link href={`/perfil/${user.username}`} className={styles.username}>
            {user.name || user.username}
          </Link>

          <Text as="div" fontSize={0} className={styles.subtitle}>
            @{user.username}
          </Text>

          <div className={styles.stats}>
            <span>{user.posts_count ?? 0} posts</span>
            <span>•</span>
            <span>{user.followers_count ?? 0} seguidores</span>
          </div>
        </div>

        {canFollow && (
          <Button
            size="small"
            variant={user.isFollowing ? "default" : "primary"}
            onClick={() => onToggleFollow(user.username, !user.isFollowing)}
            className={styles.followBtn}
          >
            {user.isFollowing ? "Seguindo" : "Seguir"}
          </Button>
        )}
      </div>
    </div>
  );
}
