import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { PageLayout, Heading, Flash, Button, Select, TextInput, Textarea, FormControl, Spinner } from "@primer/react";
import { ShieldIcon } from "@primer/octicons-react";
import { useUser } from "@/context/UserContext";
import styles from "./index.module.css";

const TARGET_LABELS = {
  post: "Post",
  user: "Usuário",
  studio: "Estúdio",
  game: "Jogo",
  boardgame: "Jogo de Mesa",
  book: "Livro/Quadrinho",
};

const TARGET_TYPES = ["post", "user", "studio", "game", "boardgame", "book"];

const REASONS = [
  "violacao_termos",
  "conteudo_ofensivo",
  "discurso_de_odio",
  "assedio",
  "conteudo_sexual",
  "violencia",
  "direitos_autorais",
  "fraude",
  "ordem_judicial",
  "outro",
];

const REASON_LABELS = {
  violacao_termos: "Violação dos Termos",
  conteudo_ofensivo: "Conteúdo Ofensivo",
  discurso_de_odio: "Discurso de Ódio",
  assedio: "Assédio",
  conteudo_sexual: "Conteúdo Sexual",
  violencia: "Violência",
  direitos_autorais: "Direitos Autorais",
  fraude: "Fraude",
  ordem_judicial: "Ordem Judicial",
  outro: "Outro",
};

function formatDate(value) {
  if (!value) return "Indeterminado";
  return new Date(value).toLocaleString("pt-BR");
}

export default function ModerationAdminPage() {
  const router = useRouter();
  const { user, loadingUser } = useUser();
  const isAdmin = Boolean(user?.features?.includes("read:admin"));

  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Pré-preenche o formulário a partir da query string
  // (ex.: botão "Bloquear" na página de denúncias).
  const [targetType, setTargetType] = useState(() =>
    router.query.target_type && TARGET_TYPES.includes(router.query.target_type) ? router.query.target_type : "post",
  );
  const [targetId, setTargetId] = useState(() => (router.query.target_id ? String(router.query.target_id) : ""));
  const [reason, setReason] = useState("violacao_termos");
  const [justification, setJustification] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/v1/moderation", { credentials: "include" });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Erro ao carregar bloqueios.");
        }
        if (!cancelled) setBlocks(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  async function reloadBlocks() {
    const res = await fetch("/api/v1/moderation", { credentials: "include" });
    const data = await res.json();
    if (res.ok) setBlocks(Array.isArray(data) ? data : []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!targetId.trim()) {
      setError("O identificador do alvo é obrigatório.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        target_type: targetType,
        target_id: targetId.trim(),
        reason,
        justification: justification.trim() || undefined,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      };

      const res = await fetch("/api/v1/moderation", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Erro ao aplicar bloqueio.");
      }

      setSuccess("Bloqueio aplicado com sucesso.");
      setTargetId("");
      setJustification("");
      setExpiresAt("");
      await reloadBlocks();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(blockId) {
    const confirmed = window.confirm("Tem certeza que deseja revogar este bloqueio?");
    if (!confirmed) return;

    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/v1/moderation/${blockId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Erro ao revogar o bloqueio.");
      }

      setSuccess("Bloqueio revogado com sucesso.");
      await reloadBlocks();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loadingUser) {
    return (
      <PageLayout>
        <PageLayout.Content width="large" className={styles.center}>
          <Spinner />
        </PageLayout.Content>
      </PageLayout>
    );
  }

  if (!isAdmin) {
    return (
      <PageLayout>
        <PageLayout.Content width="large">
          <Flash variant="danger">Acesso restrito a administradores.</Flash>
        </PageLayout.Content>
      </PageLayout>
    );
  }

  let blocksContent;
  if (loading) {
    blocksContent = (
      <div className={styles.center}>
        <Spinner />
      </div>
    );
  } else if (blocks.length === 0) {
    blocksContent = (
      <div className={styles.empty}>
        <ShieldIcon size={24} />
        <p className={styles.emptyTitle}>Nenhum bloqueio ativo</p>
        <p className={styles.emptyDescription}>Não há conteúdo bloqueado no momento.</p>
      </div>
    );
  } else {
    blocksContent = (
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Alvo</th>
              <th>Motivo</th>
              <th>Justificativa</th>
              <th>Moderador</th>
              <th>Expira em</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((block) => (
              <tr key={block.id}>
                <td>
                  <span className={styles.targetType}>{TARGET_LABELS[block.target_type] || block.target_type}</span>
                  <span className={styles.mono}>{block.target_id}</span>
                </td>
                <td>{REASON_LABELS[block.reason] || block.reason}</td>
                <td className={styles.justification}>{block.justification || "—"}</td>
                <td>{block.moderator_username}</td>
                <td>{formatDate(block.expires_at)}</td>
                <td>
                  <Button size="small" onClick={() => handleRevoke(block.id)}>
                    Revogar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <PageLayout>
      <PageLayout.Content width="large">
        <Heading as="h2">Moderação</Heading>

        {error && <Flash variant="danger">{error}</Flash>}
        {success && <Flash variant="success">{success}</Flash>}

        <section className={styles.card}>
          <Heading as="h3">Novo bloqueio</Heading>
          <form onSubmit={handleSubmit} className={styles.form}>
            <FormControl>
              <FormControl.Label>Tipo de alvo</FormControl.Label>
              <Select value={targetType} onChange={(e) => setTargetType(e.target.value)}>
                {TARGET_TYPES.map((type) => (
                  <Select.Option key={type} value={type}>
                    {TARGET_LABELS[type]}
                  </Select.Option>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <FormControl.Label>Identificador (ID) do alvo</FormControl.Label>
              <TextInput value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="Ex.: uuid do post, usuário ou obra" block />
            </FormControl>

            <FormControl>
              <FormControl.Label>Motivo</FormControl.Label>
              <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                {REASONS.map((reasonKey) => (
                  <Select.Option key={reasonKey} value={reasonKey}>
                    {REASON_LABELS[reasonKey]}
                  </Select.Option>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <FormControl.Label>Justificativa</FormControl.Label>
              <Textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Justificativa do bloqueio (opcional)"
                rows={3}
                block
              />
            </FormControl>

            <FormControl>
              <FormControl.Label>Data limite (opcional — vazio = por tempo indeterminado)</FormControl.Label>
              <TextInput type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} block />
            </FormControl>

            <Button type="submit" variant="danger" disabled={submitting}>
              {submitting ? "Aplicando..." : "Bloquear"}
            </Button>
          </form>
        </section>

        <Heading as="h3" className={styles.sectionTitle}>
          Bloqueios ativos
        </Heading>

        {blocksContent}
      </PageLayout.Content>
    </PageLayout>
  );
}
