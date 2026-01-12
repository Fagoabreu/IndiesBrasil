import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { PageLayout, Heading, Avatar, Text, Button } from "@primer/react";
import Image from "next/image";
import { useUser } from "@/context/UserContext";
import "./perfil.css";

export default function Perfil() {
  const router = useRouter();
  const { username } = router.query;

  const { user: authUser, loadingUser } = useUser();
  const [perfilUser, setPerfilUser] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Carrega perfil visitado
  useEffect(() => {
    if (!username) return;

    async function loadProfile() {
      try {
        setLoadingProfile(true);
        const res = await fetch(`/api/v1/users/${username}`, {
          credentials: "include",
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Erro ao carregar perfil");
        }

        setPerfilUser(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingProfile(false);
      }
    }

    loadProfile();
  }, [username]);

  if (loadingUser || loadingProfile) {
    return <div>Carregando...</div>;
  }

  if (!perfilUser) {
    return <div>Perfil não encontrado.</div>;
  }

  const isOwnProfile = authUser?.username === perfilUser.username;

  function formatDateBR(date) {
    if (!date) return "";
    return new Intl.DateTimeFormat("pt-BR").format(new Date(date));
  }

  return (
    <PageLayout padding="none">
      <PageLayout.Content width="medium">
        {/* Header */}
        <section className="profile-card profile-header-card">
          <div className="image-wrapper">
            <Image src="/images/sistematags.png" alt="Capa do perfil" fill unoptimized />
          </div>

          <Avatar size={128} src={perfilUser.avatarUrl || "/images/avatar.png"} className="profile-avatar" />

          <div className="profile-header-info">
            <Heading as="h2">{perfilUser.name || perfilUser.username}</Heading>
            <Text className="profile-headline">{perfilUser.email || "email"}</Text>
            <Text className="profile-headline">Desde: {formatDateBR(perfilUser.created_at) || "criado em"}</Text>

            <Text className="profile-meta">
              <strong>{perfilUser.following_count ?? 0}</strong> acompanhando · <strong>{perfilUser.followers_count ?? 0}</strong> seguidores ·{" "}
              <strong>{perfilUser.posts_count ?? 0}</strong> postagens
            </Text>

            {authUser && !isOwnProfile && (
              <div className="profile-actions">
                <Button variant="primary">Seguir</Button>
                <Button>Enviar mensagem</Button>
              </div>
            )}
          </div>
        </section>

        {/* Destaques */}
        <section className="profile-card">
          <Heading as="h3">Destaques</Heading>
          <Text className="profile-muted">Nenhum destaque disponível no momento.</Text>
        </section>

        {/* Sobre */}
        <section className="profile-card">
          <Heading as="h3">Sobre</Heading>
          <Text>{perfilUser.bio || "Este usuário ainda não adicionou uma bio."}</Text>
        </section>

        {/* Atividade */}
        <section className="profile-card">
          <Heading as="h3">Atividade</Heading>

          {(!perfilUser.posts || perfilUser.posts.length === 0) && <Text className="profile-muted">Nenhuma atividade recente.</Text>}

          {perfilUser.posts?.map((post) => (
            <div key={post.id} className="profile-post">
              <Text>{post.content}</Text>
            </div>
          ))}
        </section>
      </PageLayout.Content>
    </PageLayout>
  );
}
