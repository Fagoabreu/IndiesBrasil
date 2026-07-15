import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Avatar, ActionMenu, ActionList, Button } from "@primer/react";

import styles from "./HeaderComponent.module.css";
import { useUser } from "@/context/UserContext";
import PropTypes from "prop-types";
import { useRouter } from "next/router";
import NotificationButton from "./NotificationButton";

const ThemeSwitcher = dynamic(() => import("../ThemeSwitcher"), { ssr: false });

export default function HeaderComponent({ onMenuClick }) {
  const router = useRouter();
  const { user, logout } = useUser();

  const avatarSrc = user?.avatar_image || "/images/avatar.png";
  const usernameLabel = user?.name || user?.username || "Usuário";

  return (
    <header className={styles.headerRoot} role="banner">
      {/* Lado esquerdo: hamburguer + logo */}
      <div className={styles.headerLeft}>
        <button type="button" aria-label="Abrir menu de navegação" onClick={onMenuClick} className={styles.menuBtn}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 2.75A.75.75 0 011.75 2h12.5a.75.75 0 010 1.5H1.75A.75.75 0 011 2.75zm0 5A.75.75 0 011.75 7h12.5a.75.75 0 010 1.5H1.75A.75.75 0 011 7.75zM1.75 12a.75.75 0 000 1.5h12.5a.75.75 0 000-1.5H1.75z" />
          </svg>
        </button>

        <Link href="/" className={styles.logoArea}>
          <div className={styles.logoWrapper}>
            <Image src="/images/logo.png" alt="Logo Indies Brasil" fill sizes="36px" priority />
          </div>
          <span className={styles.logoText}>Indies Brasil</span>
        </Link>
      </div>

      {/* Lado direito: ações */}
      <div className={styles.headerRight}>
        <ThemeSwitcher />
        {user ? (
          <>
            <NotificationButton />
            <ActionMenu>
              <ActionMenu.Button>
                <div className={styles.avatarBtn}>
                  <span className={styles.avatarRing}>
                    <Avatar src={avatarSrc} size={28} />
                  </span>
                  <span className={styles.avatarUsername}>{usernameLabel}</span>
                </div>
              </ActionMenu.Button>
              <ActionMenu.Overlay>
                <ActionList>
                  <ActionList.Item onSelect={() => router.push(`/perfil/${user.username}`)}>Meu perfil</ActionList.Item>
                  <ActionList.Item onSelect={() => router.push("/estudios?member=me")}>Meus estúdios</ActionList.Item>
                  <ActionList.Divider />
                  <ActionList.Item variant="danger" onSelect={logout}>
                    Sair
                  </ActionList.Item>
                </ActionList>
              </ActionMenu.Overlay>
            </ActionMenu>
          </>
        ) : (
          <Button variant="primary" as={Link} href="/login">
            Entrar
          </Button>
        )}
      </div>
    </header>
  );
}

HeaderComponent.propTypes = {
  onMenuClick: PropTypes.func.isRequired,
};
