// components/MemberCard.jsx
import Image from "next/image";
import { Avatar, Link } from "@primer/react";
import styles from "./MemberCard.module.css";
import PropTypes from "prop-types";
import useTiltEffect from "@/hooks/useTiltEffect";

MemberCard.propTypes = {
  user: PropTypes.shape({
    avatar_image: PropTypes.string,
    background_image: PropTypes.string,
    name: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    role: PropTypes.string,
    bio: PropTypes.string,
    email: PropTypes.string,
    github: PropTypes.string,
    linkedin: PropTypes.string,
  }).isRequired,
};

export default function MemberCard({ user }) {
  const tiltRef = useTiltEffect({
    max: 10,
    perspective: 900,
    scale: 1.03,
    maxGlare: 0.15,
  });

  return (
    <Link
      className={styles.card}
      ref={tiltRef}
      href={`/perfil/${user.username}`}
      inline={true}
    >
      {/* Faixa superior com imagem de fundo */}
      <div className={styles.topDivider}>
        {user.background_image ? (
          <Image
            src={user.background_image}
            alt=""
            fill
            className={styles.topBgImg}
          />
        ) : (
          <div className={styles.topBgPlaceholder} />
        )}
      </div>

      {/* Avatar — sobreposto à divisória */}
      <div className={styles.avatarWrapper}>
        <Avatar
          src={user.avatar_image || "/images/avatar.png"}
          size={88}
          className={styles.avatar}
        />
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
    </Link>
  );
}
