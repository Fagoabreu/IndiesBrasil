import { Avatar, Button, Text, Link } from "@primer/react";
import styles from "./UserCardComponent.module.css";
import PropTypes from "prop-types";

UserCardComponent.propTypes = {
  user: PropTypes.shape({
    username: PropTypes.string.isRequired,
    name: PropTypes.string,
    avatar_image: PropTypes.string,
    posts_count: PropTypes.number,
    followers_count: PropTypes.number,
    isFollowing: PropTypes.bool,
  }).isRequired,

  onToggleFollow: PropTypes.func,
  canFollow: PropTypes.bool,
};

export default function UserCardComponent({ user, onToggleFollow, canFollow = true }) {
  return (
    <div className={styles.card}>
      <div className={styles.mainRow}>
        <div className={styles.avatarSection}>
          <Avatar size={40} src={user.avatar_image || "/images/avatar.png"} className={styles.avatar} />
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
      </div>
    </div>
  );
}
