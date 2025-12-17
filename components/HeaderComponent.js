import Link from "next/link";
import Image from "next/image";
import { Avatar, ActionMenu, ActionList, TextInput, IconButton, useTheme, Button } from "@primer/react";
import { SunIcon, MoonIcon, SearchIcon } from "@primer/octicons-react";

import { useUser } from "@/context/UserContext";

import styles from "./HeaderComponent.module.css";

export default function HeaderComponent() {
  const { colorMode, setColorMode } = useTheme();
  const { user, logout } = useUser(); // 🔥 USER + LOGOUT DO CONTEXTO

  const toggleTheme = () => setColorMode(colorMode === "day" ? "night" : "day");

  const avatarSrc = user?.avatarUrl || "/images/avatar.png";
  const usernameLabel = user?.name || user?.username || "Usuário";

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <Link href="/" className={styles.logoArea}>
          <div className={styles.logoWrapper}>
            <Image src="/images/logo.png" alt="Logo Indies Brasil" fill sizes="40px" priority />
          </div>
          <span className={styles.logoText}>Indies Brasil</span>
        </Link>

        <nav className={styles.navDesktop}>
          <Link href="/">Início</Link>
          <Link href="/posts">Posts</Link>
          <Link href="/membros">Membros</Link>
        </nav>
      </div>

      <div className={styles.center}>
        <TextInput leadingVisual={SearchIcon} placeholder="Pesquisar" />
      </div>

      <div className={styles.right}>
        <IconButton aria-label="Alternar tema" icon={colorMode === "day" ? MoonIcon : SunIcon} onClick={toggleTheme} />
        {user ? (
          <ActionMenu>
            <ActionMenu.Button>
              <Avatar src={avatarSrc} size={32} />
            </ActionMenu.Button>

            <ActionMenu.Overlay>
              <ActionList>
                <ActionList.Item onSelect={() => (window.location.href = "/perfil")}>{usernameLabel}</ActionList.Item>

                <ActionList.Item variant="danger" onSelect={logout}>
                  Sair
                </ActionList.Item>
              </ActionList>
            </ActionMenu.Overlay>
          </ActionMenu>
        ) : (
          <Button type="submit" variant="primary" as={Link} href="/login">
            Entrar
          </Button>
        )}
      </div>
    </header>
  );
}
