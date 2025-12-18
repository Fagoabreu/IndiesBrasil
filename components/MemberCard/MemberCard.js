import { Avatar } from "@primer/react";
import styles from "./MemberCard.module.css";

export default function MemberCard({ user }) {
  const initials =
    user.name
      ?.split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  return (
    <div className={styles.cardWrapper}>
      <Avatar src={user.avatar_url || "/images/avatar.png"} size={100} sx={{ borderRadius: 6 }} />

      <div className={styles.info}>
        <p className={styles.name}>{user.username}</p>
        {user.bio && <p className={styles.bio}>{user.bio}</p>}
        <p>Seguidores: {user.followers_count}</p>
      </div>
    </div>
  );
}
