import Link from "next/link";
import { Avatar, ActionMenu, ActionList, TextInput, IconButton, useTheme } from "@primer/react";
import { SunIcon, MoonIcon, SearchIcon } from "@primer/octicons-react";
import { useUser } from "@/context/UserContext.js";
import styles from "./HeaderComponent.module.css";
import { useThemeToggle } from "@/context/ThemeContext.js";

export default function HeaderComponent() {
  const { user, logout } = useUser();
  const { mode, toggleTheme } = useThemeToggle();

  return (
    <header className={`${styles.header} color-bg-default`}>
      <div className={styles.left}>
        <ActionMenu>
          <ActionMenu.Button className={styles.logoButton}>
            <img src="/images/icon.png" className={styles.logo} />
            <span className={styles.logoText}>Indies Brasil</span>
          </ActionMenu.Button>

          <ActionMenu.Overlay>
            <ActionList>
              <ActionList.Item onSelect={() => (window.location.href = "/")}>Início</ActionList.Item>
              <ActionList.Item onSelect={() => (window.location.href = "/eventos")}>Eventos</ActionList.Item>
              <ActionList.Item onSelect={() => (window.location.href = "/membros")}>Membros</ActionList.Item>
            </ActionList>
          </ActionMenu.Overlay>
        </ActionMenu>
      </div>

      <div className={styles.center}>
        <nav className={styles.nav}>
          <Link href="/">Início</Link>
          <Link href="/eventos">Eventos</Link>
          <Link href="/membros">Membros</Link>
        </nav>
      </div>

      <div className={styles.right}>
        <IconButton aria-label="Tema" className={styles.themeButton} icon={mode === "day" ? MoonIcon : SunIcon} onClick={toggleTheme} />

        <TextInput leadingVisual={SearchIcon} placeholder="Pesquisar" className={styles.search} />

        {user && (
          <ActionMenu>
            <ActionMenu.Button>
              <Avatar src={user.avatarUrl || "/images/avatar.png"} size={32} />
            </ActionMenu.Button>

            <ActionMenu.Overlay>
              <ActionList>
                <ActionList.Item onSelect={() => (location.href = "/perfil")}>Perfil</ActionList.Item>
                <ActionList.Item onSelect={logout}>Sair</ActionList.Item>
              </ActionList>
            </ActionMenu.Overlay>
          </ActionMenu>
        )}
      </div>
    </header>
  );
}
