import Link from "next/link";
import { Heading, Avatar, Button, Stack, ActionMenu, ActionList } from "@primer/react";
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
