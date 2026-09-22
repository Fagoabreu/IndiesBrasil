"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Spinner } from "@primer/react";
import { CalendarIcon, PlusIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import ShareModal from "@/components/ShareModal/ShareModal";
import EventCard from "@/components/Agenda/EventCard";
import { useUser } from "@/context/UserContext";
import { SITE_URL } from "@/lib/seo";
import { EVENT_MONTHS, sortEventsByStart } from "@/lib/eventFormat";
import styles from "./index.module.css";

const PAGE_TITLE = "Agenda — Indies Brasil";
const PAGE_DESCRIPTION = "Eventos da comunidade indie brasileira: game jams, lançamentos, reuniões, maratonas de stream e mais.";
const PAGE_URL = `${SITE_URL}/agenda`;

const FILTERS = [
  { value: "", label: "Todos" },
  { value: "game_jam", label: "Game Jams" },
  { value: "game_launch", label: "Lançamentos" },
  { value: "stream_marathon", label: "Streams" },
  { value: "meeting", label: "Reuniões" },
  { value: "general", label: "Gerais" },
];

export default function AgendaPage() {
  const { user } = useUser();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [filter, setFilter] = useState("");
  const [events, setEvents] = useState(null);
  const loading = events === null;

  // Evento cujo link está sendo compartilhado. Fica no nível da página (e não
  // em cada item) para existir um único modal aberto por vez.
  const [shareEvent, setShareEvent] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const from = new Date(year, month, 1).toISOString();
        const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
        const typeParam = filter ? `&type=${filter}` : "";
        const res = await fetch(`/api/v1/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${typeParam}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (!cancelled) setEvents(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setEvents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [year, month, filter]);

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }

  // A lista vem da API ordenada por id de instância, não por data — a ordem
  // cronológica é responsabilidade de quem exibe.
  const sorted = sortEventsByStart(events || []);

  return (
    <>
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical={PAGE_URL} />

      <div className={styles.pageWrapper}>
        {/* Cabeçalho */}
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>
            <CalendarIcon size={20} /> Agenda
          </h1>
          {user && (
            <Link href="/agenda/criar" className={styles.createBtn}>
              <PlusIcon size={14} /> Criar Evento
            </Link>
          )}
        </div>

        {/* Navegação de mês */}
        <div className={styles.monthNav}>
          <button type="button" className={styles.monthBtn} onClick={prevMonth}>
            ‹
          </button>
          <span className={styles.monthLabel}>
            {EVENT_MONTHS[month]} {year}
          </span>
          <button type="button" className={styles.monthBtn} onClick={nextMonth}>
            ›
          </button>
        </div>

        {/* Filtros de tipo */}
        <div className={styles.filters}>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`${styles.filterBtn} ${filter === f.value ? styles.filterBtnActive : ""}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading && (
          <div className={styles.spinner}>
            <Spinner size="large" />
          </div>
        )}
        {!loading && sorted.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📅</div>
            <p className={styles.emptyText}>
              Nenhum evento encontrado para {EVENT_MONTHS[month]} de {year}.
            </p>
            {user && (
              <Link href="/agenda/criar" className={styles.createBtn} style={{ marginTop: 16, display: "inline-flex" }}>
                <PlusIcon size={14} /> Criar o primeiro evento
              </Link>
            )}
          </div>
        )}
        {!loading && sorted.length > 0 && (
          <div className={styles.eventList}>
            {sorted.map((ev) => (
              <EventCard key={ev.instance_id} event={ev} onShare={setShareEvent} />
            ))}
          </div>
        )}
      </div>

      {shareEvent && (
        <ShareModal
          path={`/agenda/${shareEvent.event_id}`}
          text={`Confira "${shareEvent.override_title || shareEvent.title}" na agenda do Indies Brasil`}
          title="Compartilhar evento"
          hint="Copie o link e cole no WhatsApp, Discord ou Instagram. A miniatura do evento será exibida automaticamente."
          onClose={() => setShareEvent(null)}
        />
      )}
    </>
  );
}
