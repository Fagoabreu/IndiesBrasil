import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { PageLayout, Heading, Flash, Button, Select, Spinner } from "@primer/react";
import { ReportIcon } from "@primer/octicons-react";
import { useUser } from "@/context/UserContext";
import styles from "./index.module.css";

const TARGET_LABELS = {
  post: "Post",
  studio: "Estúdio",
  game: "Jogo",
  boardgame: "Jogo de Mesa",
  book: "Livro/Quadrinho",
  meeting: "Reunião",
};

const REASON_LABELS = {
  conteudo_ofensivo: "Conteúdo Ofensivo",
  discurso_de_odio: "Discurso de Ódio",
  assedio: "Assédio",
  conteudo_sexual: "Conteúdo Sexual",
  violencia: "Violência",
  direitos_autorais: "Direitos Autorais",
  dados_pessoais: "Dados Pessoais",
  conteudo_improprio_menores: "Conteúdo Impróprio p/ Menores",
  golpe_fraude: "Golpe/Fraude",
  spam: "Spam",
  outro: "Outro",
};

const STATUS_LABELS = {
  pending: "Pendente",
  resolved: "Resolvida",
  dismissed: "Arquivada",
};

const STATUS_OPTIONS = [
  { value: "pending", label: "Pendentes" },
  { value: "resolved", label: "Resolvidas" },
  { value: "dismissed", label: "Arquivadas" },
  { value: "", label: "Todas" },
];

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
}

export default function ReportsAdminPage() {
  const router = useRouter();
  const { user, loadingUser } = useUser();
  const isAdmin = Boolean(user?.features?.includes("read:admin"));

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [targetTypeFilter, setTargetTypeFilter] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (statusFilter) params.set("status", statusFilter);
        if (targetTypeFilter) params.set("target_type", targetTypeFilter);

        const res = await fetch(`/api/v1/reports?${params.toString()}`, {
          credentials: "include",
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Erro ao carregar denúncias.");
        }
        if (!cancelled) setReports(Array.isArray(data) ? data : []);
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
  }, [isAdmin, statusFilter, targetTypeFilter]);

  async function handleResolve(report, status) {
    const note = window.prompt(`Nota de resolução para a denúncia de ${TARGET_LABELS[report.target_type] || report.target_type} (opcional):`);

    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/v1/reports/${report.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolution_note: note || undefined }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Erro ao analisar a denúncia.");
      }

      setSuccess(status === "resolved" ? "Denúncia marcada como resolvida." : "Denúncia arquivada.");
      // Recarrega a lista respeitando o filtro atual.
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (targetTypeFilter) params.set("target_type", targetTypeFilter);
      const refreshed = await fetch(`/api/v1/reports?${params.toString()}`, { credentials: "include" });
      const refreshedData = await refreshed.json();
      if (refreshed.ok) setReports(Array.isArray(refreshedData) ? refreshedData : []);
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

  let reportsContent;
  if (loading) {
    reportsContent = (
      <div className={styles.center}>
        <Spinner />
      </div>
    );
  } else if (reports.length === 0) {
    reportsContent = (
      <div className={styles.empty}>
        <ReportIcon size={24} />
        <p className={styles.emptyTitle}>Nenhuma denúncia encontrada</p>
        <p className={styles.emptyDescription}>Não há denúncias para o filtro selecionado.</p>
      </div>
    );
  } else {
    reportsContent = (
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Denunciante</th>
              <th>Alvo</th>
              <th>Motivo</th>
              <th>Justificativa</th>
              <th>Status</th>
              <th>Data</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id}>
                <td>{report.reporter_username}</td>
                <td>
                  <span className={styles.targetType}>{TARGET_LABELS[report.target_type] || report.target_type}</span>
                  {report.target_type === "meeting" && report.meeting_title ? (
                    <span className={styles.targetName}>
                      {report.meeting_title}
                      {report.meeting_org_name ? ` · ${report.meeting_org_name}` : ""}
                    </span>
                  ) : null}
                  <span className={styles.mono}>{report.target_id}</span>
                </td>
                <td>{REASON_LABELS[report.reason] || report.reason}</td>
                <td className={styles.justification}>{report.justification || "—"}</td>
                <td>
                  <span className={`${styles.badge} ${styles[report.status]}`}>{STATUS_LABELS[report.status] || report.status}</span>
                </td>
                <td>{formatDate(report.created_at)}</td>
                <td className={styles.actions}>
                  {report.status === "pending" ? (
                    <>
                      <Button size="small" variant="primary" onClick={() => handleResolve(report, "resolved")}>
                        Resolver
                      </Button>
                      <Button size="small" variant="danger" onClick={() => handleResolve(report, "dismissed")}>
                        Arquivar
                      </Button>
                      <Button
                        size="small"
                        onClick={() => router.push(`/admin/moderation?target_type=${report.target_type}&target_id=${report.target_id}`)}
                      >
                        Bloquear
                      </Button>
                    </>
                  ) : (
                    <span className={styles.resolution}>
                      {report.resolution_note ? `Por ${report.resolver_username}` : report.resolver_username || "—"}
                    </span>
                  )}
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
        <Heading as="h2">Denúncias</Heading>

        {error && <Flash variant="danger">{error}</Flash>}
        {success && <Flash variant="success">{success}</Flash>}

        <div className={styles.filters}>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrar por status">
            {STATUS_OPTIONS.map((option) => (
              <Select.Option key={option.value} value={option.value}>
                {option.label}
              </Select.Option>
            ))}
          </Select>

          <Select value={targetTypeFilter} onChange={(e) => setTargetTypeFilter(e.target.value)} aria-label="Filtrar por tipo de alvo">
            <Select.Option value="">Todos os tipos</Select.Option>
            {Object.entries(TARGET_LABELS).map(([value, label]) => (
              <Select.Option key={value} value={value}>
                {label}
              </Select.Option>
            ))}
          </Select>
        </div>

        {reportsContent}
      </PageLayout.Content>
    </PageLayout>
  );
}
