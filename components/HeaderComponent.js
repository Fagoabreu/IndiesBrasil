import Link from "next/link";
import Image from "next/image";
import { Avatar, ActionMenu, ActionList, TextInput, IconButton, useTheme } from "@primer/react";
import { SunIcon, MoonIcon, SearchIcon } from "@primer/octicons-react";

import styles from "./HeaderComponent.module.css";

export default function HeaderComponent() {
  const { colorMode, setColorMode } = useTheme();

  const toggleTheme = () => setColorMode(colorMode === "day" ? "night" : "day");

  return (
    <header className={`${styles.header} color-bg-default color-fg-default`}>
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

        <ActionMenu>
          <ActionMenu.Button>
            <Avatar src="/images/avatar.png" size={32} />
          </ActionMenu.Button>

          <ActionMenu.Overlay>
            <ActionList>
              <ActionList.Item onSelect={() => (window.location.href = "/perfil")}>Perfil</ActionList.Item>

              <ActionList.Item variant="danger">Sair</ActionList.Item>
            </ActionList>
          </ActionMenu.Overlay>
        </ActionMenu>
      </div>
    </header>
  );
}
