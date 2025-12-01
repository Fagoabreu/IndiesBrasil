import Link from "next/link";
import { Avatar, ActionMenu, ActionList, Box, TextInput, IconButton } from "@primer/react";
import { SunIcon, MoonIcon, SearchIcon } from "@primer/octicons-react";
import { useTheme } from "@primer/react";
import { useUser } from "@/context/UserContext";
import styles from "./HeaderComponent.module.css";
import { useState, useEffect } from "react";
import { useThemeToggle } from "@/context/ThemeContext";

export default function HeaderComponent() {
  const { user, logout } = useUser();
  const { mode, toggleTheme } = useThemeToggle();

  return (
    <header className={`${styles.header} color-bg-default`}>
      <div className={styles.left}>
        {/* Logo */}
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
        {/* Tema */}
        <IconButton aria-label="Tema" icon={mode === "day" ? MoonIcon : SunIcon} onClick={toggleTheme} />

        {/* Busca */}
        <TextInput leadingVisual={SearchIcon} placeholder="Pesquisar" className={styles.search} />

        {/* Menu usuário */}
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
