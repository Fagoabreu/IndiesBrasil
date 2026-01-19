import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { PageLayout, Heading, Avatar, Text, Button } from "@primer/react";
import Image from "next/image";
import { useUser } from "@/context/UserContext";
import "./perfil.css";
import { PencilIcon } from "@primer/octicons-react";
import EditResumoModal from "@/components/Portfolio/EditResumoModal";

export default function Perfil() {
  const router = useRouter();
  const { username } = router.query;

  const { user: authUser, loadingUser } = useUser();
  const [perfilUser, setPerfilUser] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [editResumoOpen, setEditResumoOpen] = useState(false);

  // Carrega perfil visitado
  useEffect(() => {
    if (!username) return;

    async function loadProfile() {
      try {
        setLoadingProfile(true);
        const res = await fetch(`/api/v1/users/${username}/profile`, {
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

  const isOwnProfile = authUser?.username === perfilUser.user.username;

  function formatDateBR(date) {
    if (!date) return "";
    return new Intl.DateTimeFormat("pt-BR").format(new Date(date));
  }

  async function saveResumo(payload) {
    const res = await fetch(`/api/v1/users/${username}/profile`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) return;

    const updated = await res.json();

    setPerfilUser((prev) => ({
      ...prev,
      user: {
        ...prev.user,
        ...updated.user,
      },
    }));
  }

  return (
    <PageLayout padding="none">
      <PageLayout.Content width="medium">
        {/* Header */}
        <section className="profile-card profile-header-card">
          <div className="image-wrapper">
            <Image src="/images/sistematags.png" alt="Capa do perfil" fill unoptimized />
          </div>

          <Avatar size={128} src={perfilUser.user.avatar_image || "/images/avatar.png"} className="profile-avatar" />

          <div className="profile-header-info">
            <Heading as="h2">{perfilUser.name || perfilUser.user?.username}</Heading>
            <Text size="medium" className="profile-headline">
              Desde: {formatDateBR(perfilUser.user?.created_at) || "criado em"}
            </Text>

            <Text size="medium" className="profile-meta">
              <strong>{perfilUser.user?.following_count ?? 0}</strong> acompanhando · <strong>{perfilUser.followers_count ?? 0}</strong> seguidores ·{" "}
              <strong>{perfilUser.user?.posts_count ?? 0}</strong> postagens
            </Text>

            {authUser && !isOwnProfile && (
              <div className="profile-actions">
                <Button variant="primary">Seguir</Button>
                <Button>Enviar mensagem</Button>
              </div>
            )}
          </div>

          {/* ===== CORPO ESTILO CURRÍCULO ===== */}
          <section className="profile-resume">
            {/* COLUNA PRINCIPAL */}
            <div className="resume-main">
              {/* Section  Resumo*/}
              <section className="resume-section">
                <div className="resume-header">
                  <Heading as="h2" variant="medium">
                    Descrição
                  </Heading>
                  {isOwnProfile && (
                    <Button size="small" variant="primary" onClick={() => setEditResumoOpen(true)}>
                      <PencilIcon /> Editar
                    </Button>
                  )}
                </div>

                {isOwnProfile && editResumoOpen && (
                  <EditResumoModal
                    onClose={() => setEditResumoOpen(false)}
                    initResume={perfilUser.user?.resumo}
                    initBio={perfilUser.user?.bio}
                    initVisibility={perfilUser.user?.visibility}
                    onSave={saveResumo}
                  />
                )}
                <div className="resume-item row">
                  <Heading as="h3" variant="small">
                    Visibilidade
                  </Heading>
                  <Text size="medium">{perfilUser.user?.visibility || "public"}</Text>
                </div>

                <div className="resume-item">
                  <Heading as="h3" variant="small">
                    Resumo
                  </Heading>
                  <Text size="medium">{perfilUser.user?.resumo || "Resumo ainda não informado."}</Text>
                </div>
                <div className="resume-item">
                  <Heading as="h3" variant="small">
                    Bio
                  </Heading>
                  <Text size="medium">{perfilUser.user?.bio || "Bio ainda não informado."}</Text>
                </div>
              </section>
              {/* Section  Experiencias*/}
              <section className="resume-section">
                <Heading as="h3" variant="medium">
                  Histórico Profissional
                </Heading>

                {(!perfilUser.portfolio_historico || perfilUser.portfolio_historico.length === 0) && (
                  <Text variant="medium" className="profile-muted">
                    Nenhuma experiência cadastrada.
                  </Text>
                )}

                <ul className="resume-list">
                  {perfilUser.portfolio_historico?.map((historico) => (
                    <li key={historico.id} className="resume-item">
                      <strong>{historico.cargo}</strong>

                      <Text variant="medium" className="resume-sub">
                        {historico.company}
                        {historico.cidade && ` · ${historico.cidade}`}
                        {historico.estado && ` · ${historico.estado}`}
                      </Text>

                      <Text size="medium" className="resume-date">
                        {formatDateBR(historico.init_date)} — {historico.end_date ? formatDateBR(historico.end_date) : "Atual"}
                      </Text>

                      {Array.isArray(historico.atribuicoes) && (
                        <ul className="resume-attributes">
                          {historico.atribuicoes.map((atribuicao, index) => (
                            <li key={index}>
                              <Text variant="medium">{atribuicao}</Text>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
              {/* Section  Formacao*/}
              <section className="resume-section">
                <Heading as="h3" variant="medium">
                  Formação Acadêmica
                </Heading>

                {(perfilUser.formacoes || []).length === 0 && (
                  <Text size="medium" className="profile-muted">
                    Nenhuma formação cadastrada.
                  </Text>
                )}

                {perfilUser.formacoes?.map((formacoes) => (
                  <div key={formacoes.id} className="resume-item">
                    <strong>{formacoes.nome}</strong>
                    <Text size="medium" className="resume-sub">
                      {formacoes.instituicao}
                    </Text>
                    <Text size="medium" className="resume-date">
                      {formacoes.inicio} — {formacoes.fim}
                    </Text>
                  </div>
                ))}
              </section>
            </div>

            {/* COLUNA LATERAL */}
            <aside className="resume-sidebar">
              {/* Section  Contatos*/}
              <section className="resume-section">
                <Heading as="h4" variant="medium">
                  Contato
                </Heading>
                <ul className="resume-list">
                  {perfilUser.users_contacts?.map((contato) => (
                    <li key={contato.id}>
                      {contato.key} — {contato.value} - {contato.icon}
                    </li>
                  ))}
                </ul>
              </section>

              {/* Section  habilidades*/}
              <section className="resume-section">
                <Heading as="h4" variant="medium">
                  Especializações
                </Heading>
                <ul className="resume-list">
                  {(perfilUser.portfolio_roles || []).map((role) => (
                    <li key={role.id}>
                      {role.name} - {role.experience}
                    </li>
                  ))}
                </ul>
              </section>
              {/* Section  Ferramentas*/}
              <section className="resume-section">
                <Heading as="h4" variant="medium">
                  Ferramentas
                </Heading>
                <ul className="resume-list">
                  {(perfilUser.portfolio_tools || []).map((tool) => (
                    <li key={tool.id}>
                      {tool.name} - {tool.icon_img} - {tool.experience}
                    </li>
                  ))}
                </ul>
              </section>
            </aside>
          </section>
        </section>

        {/* Destaques */}
        <section className="profile-card">
          <Heading as="h3" variant="medium">
            Destaques
          </Heading>
          <Text size="medium" className="profile-muted">
            Nenhum destaque disponível no momento.
          </Text>
        </section>

        {/* Atividade */}
        <section className="profile-card">
          <Heading as="h3" variant="medium">
            Atividade
          </Heading>

          {(!perfilUser.posts || perfilUser.posts.length === 0) && (
            <Text size="medium" className="profile-muted">
              Nenhuma atividade recente.
            </Text>
          )}

          {perfilUser.posts?.map((post) => (
            <div key={post.id} className="profile-post">
              <Text size="medium">{post.content}</Text>
            </div>
          ))}
        </section>
      </PageLayout.Content>
    </PageLayout>
  );
}
