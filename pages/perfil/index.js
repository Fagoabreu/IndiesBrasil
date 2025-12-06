import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { PageLayout, Heading, Avatar, Stack, Text, Button, TextInput } from "@primer/react";
import { useUser } from "../../context/UserContext";

export default function Perfil() {
  const router = useRouter();
  const { user, loadingUser } = useUser();

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    bio: "",
    website: "",
    location: "",
  });

  // ref para fechar modal ao clicar fora
  const modalRef = useRef(null);

  function openEditModal() {
    if (user) {
      setEditForm({
        name: user.name || user.username || "",
        bio: user.bio || "",
        website: user.website || "",
        location: user.location || "",
      });
    }
    setEditing(true);
  }

  useEffect(() => {
    if (!loadingUser && !user) {
      router.push("/login");
    }
  }, [loadingUser, user, router]);

  // fechar modal com ESC
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setEditing(false);
    }
    if (editing) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [editing]);

  if (loadingUser) return <div>Carregando...</div>;
  if (!user) return null;

  const isOwnProfile = true; // adaptar se tiver perfil público / id na rota

  async function handleSave() {
    // implementar chamada ao backend para salvar o profile
    // exemplo:
    // await fetch('/api/v1/users/me', { method: 'PATCH', body: JSON.stringify(editForm) })
    setEditing(false);
  }

  // clicar fora fecha modal
  function onOverlayClick(e) {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      setEditing(false);
    }
  }

  return (
    <PageLayout padding="spacious">
      <PageLayout.Header>
        <Heading as="h2">Perfil</Heading>
      </PageLayout.Header>

      <PageLayout.Content width="large">
        <Stack direction="vertical" gap={5} alignItems="center">
          {/* Avatar + Nome */}
          <Stack direction="vertical" alignItems="center" gap={2}>
            <Avatar size={96} src={user.avatarUrl || "/images/avatar.png"} />
            <Heading as="h3">{user.name || user.username}</Heading>
            <Text sx={{ color: "fg.muted" }}>@{user.username}</Text>
            {user.bio && <Text sx={{ textAlign: "center", maxWidth: 600 }}>{user.bio}</Text>}
          </Stack>

          {/* Stats */}
          <Stack direction="horizontal" gap={5} sx={{ alignItems: "center" }}>
            <Stack direction="vertical" alignItems="center" gap={1}>
              <Heading as="h4">{user.following_count ?? 0}</Heading>
              <Text sx={{ color: "fg.muted" }}>Following</Text>
            </Stack>

            <Stack direction="vertical" alignItems="center" gap={1}>
              <Heading as="h4">{user.followers_count ?? 0}</Heading>
              <Text sx={{ color: "fg.muted" }}>Followers</Text>
            </Stack>

            <Stack direction="vertical" alignItems="center" gap={1}>
              <Heading as="h4">{user.posts_count ?? 0}</Heading>
              <Text sx={{ color: "fg.muted" }}>Posts</Text>
            </Stack>
          </Stack>

          {/* Ações */}
          {isOwnProfile ? (
            <Button variant="primary" onClick={openEditModal} sx={{ width: 200 }}>
              Editar Perfil
            </Button>
          ) : (
            <Button sx={{ width: 200 }}>Seguir</Button>
          )}

          {/* Extra info */}
          <Stack direction="vertical" gap={1} alignItems="center" sx={{ color: "fg.muted" }}>
            {user.location && <Text>{user.location}</Text>}
            {user.website && (
              <a style={{ color: "var(--fg-default)", textDecoration: "underline" }} href={user.website.startsWith("http") ? user.website : `https://${user.website}`} target="_blank" rel="noreferrer">
                {user.website}
              </a>
            )}
          </Stack>

          {/* Posts list (simples) */}
          <Stack direction="vertical" gap={3} sx={{ width: "100%", maxWidth: 800 }}>
            <Heading as="h4">Posts</Heading>

            {(!user.posts || user.posts.length === 0) && <Text sx={{ color: "fg.muted", textAlign: "center", py: 4 }}>Nenhum post ainda.</Text>}

            {user.posts &&
              user.posts.map((post) => (
                <Stack
                  key={post.id}
                  direction="vertical"
                  gap={2}
                  sx={{
                    padding: 3,
                    border: "1px solid",
                    borderColor: "border.default",
                    borderRadius: 2,
                  }}
                >
                  <Text>{post.content}</Text>
                </Stack>
              ))}
          </Stack>
        </Stack>
      </PageLayout.Content>

      {/* Modal custom (sem dependências externas) */}
      {editing && (
        <div
          onMouseDown={onOverlayClick}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          aria-modal="true"
          role="dialog"
        >
          <div
            ref={modalRef}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: "min(720px, 96%)",
              background: "var(--canvas-default, #fff)",
              borderRadius: 10,
              padding: 20,
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            }}
          >
            <Stack direction="vertical" gap={3}>
              <Heading as="h3">Editar Perfil</Heading>

              <Stack direction="vertical" gap={2}>
                <label style={{ fontSize: 12, color: "var(--fg-muted)" }}>Nome</label>
                <TextInput block value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </Stack>

              <Stack direction="vertical" gap={2}>
                <label style={{ fontSize: 12, color: "var(--fg-muted)" }}>Bio</label>
                <TextInput block value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} />
              </Stack>

              <Stack direction="horizontal" gap={2} sx={{ justifyContent: "flex-end" }}>
                <Button variant="invisible" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" onClick={handleSave}>
                  Salvar
                </Button>
              </Stack>
            </Stack>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
