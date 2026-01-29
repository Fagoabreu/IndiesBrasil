// components/MemberCard.jsx
import { Avatar, Link } from "@primer/react";
import styles from "./MemberCard.module.css";
import { useRouter } from "next/router";

export default function MemberCard({ user }) {
  const router = useRouter();
  const redirect = () => {
    router.push(`/perfil/${user.username}`);
  };
  return (
    <div className={styles.card} onClick={redirect}>
      {/* Avatar */}
      <div className={styles.avatarWrapper}>
        <Avatar src={user.avatar_image || "/images/avatar.png"} size={96} className={styles.avatar} />
      </div>

      {/* Nome */}
      <p className={styles.name}>{user.name || user.username}</p>

      {/* Cargo / subtítulo */}
      {user.role && <p className={styles.role}>{user.role}</p>}

      {/* Bio */}
      {user.bio && <p className={styles.bio}>{user.bio}</p>}

      {/* Email */}
      {user.email && (
        <div className={styles.emailBox}>
          <Link href={`mailto:${user.email}`} className={styles.email}>
            {user.email}
          </Link>
        </div>
      )}

      {/* Redes sociais (opcional / extensível) */}
      <div className={styles.socials}>
        {user.github && (
          <Link href={user.github} target="_blank">
            GitHub
          </Link>
        )}
        {user.linkedin && (
          <Link href={user.linkedin} target="_blank">
            LinkedIn
          </Link>
        )}
      </div>
    </div>
  );
}
