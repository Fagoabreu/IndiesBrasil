// pages/agenda/[id]/editar.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Spinner } from "@primer/react";
import { ArrowLeftIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import EventForm from "@/components/Agenda/EventForm";
import { eventValuesFromApi } from "@/components/Agenda/eventFormOptions";
import styles from "@/components/Agenda/EventFormPage.module.css";

export default function EditarEventoPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  // O evento carregado alimenta o EventForm de uma vez (initialValues), em vez
  // de um estado por campo com um populateForm para sincronizar.
  const [event, setEvent] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/events/${id}`, {
          credentials: "include",
        });
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        if (!data.is_owner) {
          setForbidden(true);
          return;
        }
        setEvent(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  /**
   * Aplica a alteração de capa pendente depois que o PATCH deu certo.
   *
   * Antes a capa era salva na hora (upload, link ou remoção), enquanto todos os
   * outros campos só valiam no "Salvar Alterações" — a diferença fazia com que
   * sair da tela sem salvar deixasse a capa alterada e o resto não.
   */
  async function applyBannerChange(banner) {
    const endpoint = `/api/v1/events/${id}/banner`;

    if (banner.action === "removed") {
      await fetch(endpoint, { method: "DELETE", credentials: "include" });
      return;
    }

    if (banner.action === "external") {
      await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ external_url: banner.externalUrl.trim() }),
      });
      return;
    }

    if (banner.action === "upload" && banner.file) {
      const formData = new FormData();
      formData.append("file", banner.file, "capa-evento.png");
      await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
    }
  }

  async function handleSubmit({ payload, banner }) {
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch(`/api/v1/events/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Erro ao salvar as alterações.");
        return;
      }

      if (banner.action !== "unchanged") {
        await applyBannerChange(banner);
      }

      router.push(`/agenda/${id}`);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.center}>
        <Spinner size="large" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className={styles.center}>
        <p>Evento não encontrado.</p>
        <Link href="/agenda">← Voltar para a agenda</Link>
      </div>
    );
  }

  if (forbidden || !user) {
    return (
      <div className={styles.center}>
        <p>Você não tem permissão para editar este evento.</p>
        <Link href={`/agenda/${id}`}>← Ver evento</Link>
      </div>
    );
  }

  return (
    <>
      <SeoHead title="Editar Evento — Agenda Indies Brasil" description="Edite as informações do evento." />

      <div className={styles.pageWrapper}>
        <Link href={`/agenda/${id}`} className={styles.backLink}>
          <ArrowLeftIcon size={14} /> Voltar ao evento
        </Link>

        <h1 className={styles.pageTitle}>Editar Evento</h1>

        <EventForm
          mode="edit"
          initialValues={eventValuesFromApi(event)}
          initialBannerUrl={event.banner_url || null}
          error={error}
          submitting={submitting}
          onSubmit={handleSubmit}
          cancelHref={`/agenda/${id}`}
          submitLabel="Salvar Alterações"
        />
      </div>
    </>
  );
}
