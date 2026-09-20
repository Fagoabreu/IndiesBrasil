// pages/agenda/criar.js
import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeftIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import EventForm from "@/components/Agenda/EventForm";
import { emptyEventValues } from "@/components/Agenda/eventFormOptions";
import styles from "@/components/Agenda/EventFormPage.module.css";

// Valores iniciais criados uma única vez: o EventForm guarda a referência como
// estado e nunca a muta (todo update gera um objeto novo).
const INITIAL_VALUES = emptyEventValues();

export default function CriarEventoPage() {
  const router = useRouter();
  const { user } = useUser();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit({ payload, banner }) {
    setError("");
    setSubmitting(true);

    try {
      // O banner por link externo vai no próprio corpo da criação; o arquivo só
      // pode subir depois, porque a rota do banner exige um evento existente.
      const body = banner.action === "external" ? { ...payload, banner_external_url: banner.externalUrl.trim() } : payload;

      const res = await fetch("/api/v1/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Erro ao criar evento.");
        return;
      }

      if (banner.action === "upload" && banner.file) {
        const formData = new FormData();
        formData.append("file", banner.file, "capa-evento.png");
        await fetch(`/api/v1/events/${data.id}/banner`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
      }

      router.push(`/agenda/${data.id}`);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return (
      <div className={styles.pageWrapper}>
        <p>
          <Link href="/login">Faça login</Link> para criar eventos.
        </p>
      </div>
    );
  }

  return (
    <>
      <SeoHead title="Criar Evento — Agenda Indies Brasil" description="Crie um novo evento na agenda da comunidade Indies Brasil." />

      <div className={styles.pageWrapper}>
        <Link href="/agenda" className={styles.backLink}>
          <ArrowLeftIcon size={14} /> Agenda
        </Link>

        <h1 className={styles.pageTitle}>Criar Evento</h1>

        <EventForm
          mode="create"
          initialValues={INITIAL_VALUES}
          enableRecurrence
          error={error}
          submitting={submitting}
          onSubmit={handleSubmit}
          cancelHref="/agenda"
          submitLabel="Criar Evento"
        />
      </div>
    </>
  );
}
