"use client";
import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Spinner } from "@primer/react";
import { CalendarIcon, PlusIcon, LocationIcon, BroadcastIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import { SITE_URL } from "@/lib/seo";
import styles from "./index.module.css";

const PAGE_TITLE = "Agenda — Indies Brasil";
const PAGE_DESCRIPTION = "Eventos da comunidade indie brasileira: game jams, lançamentos, reuniões, maratonas de stream e mais.";
const PAGE_URL = `${SITE_URL}/agenda`;

const TYPE_LABELS = {
  general: "Geral",
  game_launch: "Lançamento",
  game_jam: "Game Jam",
  stream_marathon: "Maratona",
  meeting: "Reunião",
  studio: "Estúdio",
};

const FILTERS = [
  { value: "", label: "Todos" },
  { value: "game_jam", label: "Game Jams" },
  { value: "game_launch", label: "Lançamentos" },
  { value: "stream_marathon", label: "Streams" },
  { value: "meeting", label: "Reuniões" },
  { value: "general", label: "Gerais" },
];

const PT_MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const PT_MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function isSameDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return da.toDateString() === db.toDateString();
}

function formatDateRange(startsAt, endsAt) {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  if (isSameDay(startsAt, endsAt)) {
    return `${formatTime(startsAt)} – ${formatTime(endsAt)}`;
  }
  return `${s.getDate()}/${PT_MONTHS_SHORT[s.getMonth()]} – ${e.getDate()}/${PT_MONTHS_SHORT[e.getMonth()]}`;
}

export default function AgendaPage() {
  const { user } = useUser();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [filter, setFilter] = useState("");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date(year, month, 1).toISOString();
      const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const typeParam = filter ? `&type=${filter}` : "";
      const res = await fetch(`/api/v1/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${typeParam}`, {
        credentials: "include",
      });
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [year, month, filter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEvents();
  }, [loadEvents]);

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

  // Agrupa eventos por dia
  const grouped = events.reduce((acc, ev) => {
    const d = new Date(ev.starts_at);
    const key = d.toDateString();
    if (!acc[key]) acc[key] = { date: d, items: [] };
    acc[key].items.push(ev);
    return acc;
  }, {});

  const days = Object.values(grouped).sort((a, b) => a.date - b.date);

  return (
    <>
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} url={PAGE_URL} />

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
            {PT_MONTHS[month]} {year}
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
        {!loading && days.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📅</div>
            <p className={styles.emptyText}>
              Nenhum evento encontrado para {PT_MONTHS[month]} de {year}.
            </p>
            {user && (
              <Link href="/agenda/criar" className={styles.createBtn} style={{ marginTop: 16, display: "inline-flex" }}>
                <PlusIcon size={14} /> Criar o primeiro evento
              </Link>
            )}
          </div>
        )}
        {!loading && days.length > 0 && (
          <div className={styles.eventList}>
            {days.map(({ date, items }) => (
              <div key={date.toDateString()}>
                {items.map((ev) => (
                  <Link key={ev.instance_id} href={`/agenda/${ev.event_id}`} className={styles.eventCard}>
                    {/* Data */}
                    <div className={styles.dateBadge}>
                      <span className={styles.dateDay}>{date.getDate()}</span>
                      <span className={styles.dateMonth}>{PT_MONTHS_SHORT[date.getMonth()]}</span>
                    </div>

                    {/* Corpo */}
                    <div className={styles.eventBody}>
                      <div className={styles.eventTop}>
                        <span className={`${styles.typeBadge} ${styles[ev.event_type]}`}>{TYPE_LABELS[ev.event_type] ?? ev.event_type}</span>
                        {ev.visibility === "private" && <span className={styles.privateBadge}>🔒 Privado</span>}
                      </div>

                      <h2 className={styles.eventTitle}>{ev.override_title || ev.title}</h2>

                      <div className={styles.eventMeta}>
                        {!ev.is_all_day && <span className={styles.metaItem}>🕐 {formatDateRange(ev.starts_at, ev.ends_at)}</span>}
                        {ev.is_online && (
                          <span className={styles.onlineBadge}>
                            <BroadcastIcon size={12} /> Online
                          </span>
                        )}
                        {!ev.is_online && ev.location_name && (
                          <span className={styles.metaItem}>
                            <LocationIcon size={12} /> {ev.location_name}
                          </span>
                        )}
                        <span className={styles.metaItem}>por @{ev.organizer_username}</span>
                      </div>

                      {ev.rsvp_going > 0 && (
                        <span className={styles.rsvpCount}>
                          <span className={styles.rsvpCountGoing}>{ev.rsvp_going}</span> confirmado{ev.rsvp_going === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>

                    {/* Banner */}
                    {ev.banner_url && (
                      <div className={styles.eventBanner}>
                        <Image src={ev.banner_url} alt="" fill className={styles.bannerThumb} sizes="300px" />
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
