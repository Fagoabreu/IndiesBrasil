import Link from "next/link";
import Image from "next/image";
import { Avatar, ActionMenu, ActionList, IconButton, useTheme, Button, PageHeader } from "@primer/react";
import { SunIcon, MoonIcon } from "@primer/octicons-react";

import styles from "./HeaderComponent.module.css";
import { useUser } from "@/context/UserContext";

export default function HeaderComponent() {
  const { colorMode, setColorMode } = useTheme();
  const { user, logout } = useUser();

  const toggleTheme = () => setColorMode(colorMode === "day" ? "night" : "day");

  const avatarSrc = user?.avatarUrl || "/images/avatar.png";
  const usernameLabel = user?.name || user?.username || "Usuário";

  return (
    <PageHeader role="banner" aria-label="Title">
      <PageHeader.TitleArea>
        <PageHeader.Title>
          <Link href="/" className={styles.logoArea}>
            <div className={styles.logoWrapper}>
              <Image src="/images/logo.png" alt="Logo Indies Brasil" fill sizes="40px" priority />
            </div>
            <span className={styles.logoText}>Indies Brasil</span>
          </Link>
        </PageHeader.Title>
      </PageHeader.TitleArea>
      <PageHeader.Description>
        <span style={{ fontSize: "var(--text-body-size-medium)", color: "var(--fgColor-muted)" }}>comunidade dos jogos brasileiros</span>
      </PageHeader.Description>

      <PageHeader.Actions>
        <IconButton aria-label="Alternar tema" icon={colorMode === "day" ? MoonIcon : SunIcon} onClick={toggleTheme} />
        {user ? (
          <ActionMenu>
            <ActionMenu.Button>
              <Avatar src={avatarSrc} size={32} />
            </ActionMenu.Button>

            <ActionMenu.Overlay>
              <ActionList>
                <ActionList.Item onSelect={() => (window.location.href = `/perfil/${user.username}`)}>{usernameLabel}</ActionList.Item>

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
      </PageHeader.Actions>
    </PageHeader>
  );
}
