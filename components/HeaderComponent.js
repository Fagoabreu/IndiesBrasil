import Link from "next/link";
import { Avatar, ActionMenu, ActionList, TextInput, IconButton, useTheme } from "@primer/react";
import { SunIcon, MoonIcon, SearchIcon } from "@primer/octicons-react";

import styles from "./HeaderComponent.module.css";

export default function HeaderComponent() {
  const { colorMode, setColorMode } = useTheme();

  const toggleTheme = () => {
    setColorMode(colorMode === "day" ? "night" : "day");
  };

  return (
    <header className={`${styles.header} color-bg-default color-fg-default`}>
      <div className={styles.left}>
        <ActionMenu>
          <ActionMenu.Button className={styles.logoButton}>
            <img src="/images/logo.png" className={styles.logo} />
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
        {/* Toggle de tema */}
        <IconButton aria-label="Alternar tema" icon={colorMode === "day" ? MoonIcon : SunIcon} onClick={toggleTheme} />

        {/* Busca */}
        <TextInput leadingVisual={SearchIcon} placeholder="Pesquisar" className={styles.search} />

        {/* Avatar do usuário */}
        <ActionMenu>
          <ActionMenu.Button>
            <Avatar src="/images/avatar.png" size={32} />
          </ActionMenu.Button>

          <ActionMenu.Overlay>
            <ActionList>
              <ActionList.Item onSelect={() => (location.href = "/perfil")}>Perfil</ActionList.Item>
              <ActionList.Item>Sair</ActionList.Item>
            </ActionList>
          </ActionMenu.Overlay>
        </ActionMenu>
      </div>
    </header>
  );
}
