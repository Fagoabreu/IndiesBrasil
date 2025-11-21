import Link from "next/link";
import { Heading, Avatar, Button, Stack, ActionMenu } from "@primer/react";

function HeaderComponent({ user }) {
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
            <ActionMenu.Item>Perfil</ActionMenu.Item>
            <ActionMenu.Item>Configurações</ActionMenu.Item>
            <ActionMenu.Divider />
            <ActionMenu.Item>Sair</ActionMenu.Item>
          </ActionMenu.Overlay>
        </ActionMenu>
      ) : (
        <Stack direction="horizontal" gap={3}>
          {/* Botão Login */}
          <Link href="/login" style={{ textDecoration: "none" }}>
            <Button variant="invisible">Login</Button>
          </Link>

          {/* Botão Cadastrar */}
          <Link href="/cadastro" style={{ textDecoration: "none" }}>
            <Button variant="primary">Cadastrar</Button>
          </Link>
        </Stack>
      )}
    </Stack>
  );
}

export default HeaderComponent;
