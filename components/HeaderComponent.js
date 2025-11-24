import Link from "next/link";
import { Heading, Avatar, Button, Stack, ActionMenu } from "@primer/react";
import { useUser } from "@/context/UserContext.js";

function HeaderComponent() {
  const { user, logout } = useUser();

  return (
    <Stack
      direction="horizontal"
      gap={3}
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 3,
      }}
    >
      {/* Logo/link para home */}
      <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
        <Heading as="h1" sx={{ fontSize: 3, cursor: "pointer" }}>
          GameDev Social
        </Heading>
      </Link>

      {user ? (
        <ActionMenu>
          <ActionMenu.Anchor>
            <Avatar src={user.avatarUrl} size={32} />
          </ActionMenu.Anchor>
          <ActionMenu.Overlay>
            <ActionMenu.Item onSelect={() => (location.href = "/perfil")}>Perfil</ActionMenu.Item>
            <ActionMenu.Item>Sair</ActionMenu.Item>
            <ActionMenu.Item onSelect={logout}>Sair</ActionMenu.Item>
          </ActionMenu.Overlay>
        </ActionMenu>
      ) : (
        <Stack direction="horizontal" gap={3}>
          <Link href="/login">
            <Button variant="invisible">Login</Button>
          </Link>
          <Link href="/cadastro">
            <Button variant="primary">Cadastrar</Button>
          </Link>
        </Stack>
      )}
    </Stack>
  );
}

export default HeaderComponent;
