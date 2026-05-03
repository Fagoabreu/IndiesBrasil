import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Avatar, ActionMenu, ActionList, IconButton, Button, PageHeader } from "@primer/react";
import { ThreeBarsIcon } from "@primer/octicons-react";

import styles from "./HeaderComponent.module.css";
import { useUser } from "@/context/UserContext";
import PropTypes from "prop-types";
import { useRouter } from "next/router";

// ThemeSwitcher depende de window.matchMedia e localStorage — estado exclusivo do cliente.
// ssr: false impede que seja renderizado no servidor, eliminando o hydration mismatch.
// Documentação: https://nextjs.org/docs/pages/guides/lazy-loading#with-no-ssr
const ThemeSwitcher = dynamic(() => import("../ThemeSwitcher"), { ssr: false });

export default function HeaderComponent({ onMenuClick }) {
  const router = useRouter();
  const { user, logout } = useUser();

  const avatarSrc = user?.avatar_image || "/images/avatar.png";
  const usernameLabel = user?.name || user?.username || "Usuário";

  return (
    <PageHeader role="banner" aria-label="Title">
      <PageHeader.TitleArea>
        <PageHeader.LeadingAction>
          <IconButton
            aria-label="Abrir menu de navegação"
            icon={ThreeBarsIcon}
            onClick={onMenuClick}
            className={styles.mobileMenuBtn}
            variant="invisible"
          />
        </PageHeader.LeadingAction>
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
        <ThemeSwitcher />
        {user ? (
          <ActionMenu>
            <ActionMenu.Button>
              <Avatar src={avatarSrc} size={32} />
            </ActionMenu.Button>

            <ActionMenu.Overlay>
              <ActionList>
                <ActionList.Item onSelect={() => router.push(`/perfil/${user.username}`)}>{usernameLabel}</ActionList.Item>

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

HeaderComponent.propTypes = {
  onMenuClick: PropTypes.func.isRequired,
};
