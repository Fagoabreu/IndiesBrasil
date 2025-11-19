import { Heading, Avatar, Button, Stack, ActionMenu } from "@primer/react";

function HeaderComponent({ user }) {
  return (
    <Stack direction="horizontal" gap={3} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 3 }}>
      <Heading as="h1" sx={{ fontSize: 3 }}>
        GameDev Social
      </Heading>

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
        <Stack direction="horizontal" gap={3} sx={{ display: "flex" }}>
          <Button variant="invisible">Login</Button>
          <Button variant="primary">Cadastrar</Button>
        </Stack>
      )}
    </Stack>
  );
}
export default HeaderComponent;
