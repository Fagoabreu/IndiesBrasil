"use client";
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heading, TextInput, Spinner } from "@primer/react";
import { BookIcon, CheckIcon, PlusIcon, StarFillIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import useTiltEffect from "@/hooks/useTiltEffect";
import { SITE_URL } from "@/lib/seo";
import styles from "./index.module.css";

const PAGE_TITLE = "Cursos — Indies Brasil";
const PAGE_DESCRIPTION = "Aprenda sobre desenvolvimento de jogos, arte, Unity, Godot e muito mais com cursos criados pela comunidade.";
const PAGE_URL = `${SITE_URL}/estudos`;

export default function CursosPage() {
  const { user } = useUser();

  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [showEnrolled, setShowEnrolled] = useState(false);

  const loadCourses = useCallback(
    async (pageNum, searchQuery, tagFilter) => {
      setLoading(true);
      try {
        if (showEnrolled) {
          const params = new URLSearchParams({ search: searchQuery });
          const res = await fetch(`/api/v1/courses/enrolled?${params}`, { credentials: "include" });
          const data = await res.json();
          const rows = Array.isArray(data) ? data : [];
          setCourses(rows);
          setHasMore(false);
        } else {
          const params = new URLSearchParams({ page: pageNum, limit: 20, search: searchQuery, tag: tagFilter });
          const res = await fetch(`/api/v1/courses?${params}`, { credentials: "include" });
          const data = await res.json();
          const rows = Array.isArray(data) ? data : [];
          setCourses((prev) => (pageNum === 1 ? rows : [...prev, ...rows]));
          setHasMore(rows.length === 20);
        }
      } catch {
        setCourses([]);
      } finally {
        setLoading(false);
      }
    },
    [showEnrolled],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      loadCourses(1, search, tag);
    }, 350);
    return () => clearTimeout(t);
  }, [search, tag, showEnrolled, loadCourses]);

  useEffect(() => {
    if (page > 1) loadCourses(page, search, tag);
  }, [page, search, tag, loadCourses]);

  const countStr = courses.length.toLocaleString("pt-BR");
  const countWord = courses.length === 1 ? "curso" : "cursos";

  return (
    <div className={styles.page}>
      <SeoHead
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        canonical={PAGE_URL}
        openGraph={{ title: PAGE_TITLE, description: PAGE_DESCRIPTION, url: PAGE_URL }}
      />

      <header className={styles.pageHeader}>
        <div className={styles.headerBlock}>
          <div className={styles.headerTitle}>
            <Heading as="h2">Cursos</Heading>
            {!loading && (
              <span className={styles.courseCount} aria-live="polite">
                {countStr} {countWord}
              </span>
            )}
          </div>
          <p className={styles.pageSubtitle}>{showEnrolled ? "Cursos em que você está inscrito." : "Aprenda com a comunidade indie brasileira."}</p>

          <div className={styles.searchWrapper}>
            <TextInput
              aria-label="Pesquisar cursos"
              placeholder="Pesquisar por título ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leadingVisual="search"
              className={styles.searchInput}
            />
          </div>

          {!showEnrolled && (
            <div className={styles.tagFilters}>
              {["Jogo", "Unity", "Godot", "Arte", "Som", "Programação", "Design", "Marketing"].map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`${styles.tagBtn} ${tag === t.toLowerCase() ? styles.tagBtnActive : ""}`}
                  onClick={() => setTag((prev) => (prev === t.toLowerCase() ? "" : t.toLowerCase()))}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.headerRight}>
          {user?.features?.includes("read:course:enrollment") && (
            <button
              type="button"
              className={`${styles.btnOutline} ${showEnrolled ? styles.btnPrimary : ""}`}
              onClick={() => {
                setShowEnrolled((p) => !p);
                setTag("");
              }}
            >
              {showEnrolled ? <CheckIcon size={14} /> : <BookIcon size={14} />}
              {showEnrolled ? "Minhas inscrições" : "Minhas inscrições"}
            </button>
          )}
          {user?.features?.includes("create:course") && (
            <Link href="/estudos/novo" className={styles.btnPrimary}>
              <PlusIcon size={14} /> Criar curso
            </Link>
          )}
        </div>
      </header>

      {loading && page === 1 && (
        <div className={styles.loadingState} role="status" aria-live="polite">
          <Spinner size="medium" />
          <span>Carregando...</span>
        </div>
      )}

      {!loading && courses.length === 0 && (
        <div className={styles.emptyState} role="status" aria-live="polite">
          <BookIcon size={40} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>
            {showEnrolled
              ? search
                ? `Nenhum curso inscrito encontrado para "${search}"`
                : "Você ainda não se inscreveu em nenhum curso"
              : search || tag
                ? `Nenhum curso encontrado${search ? ` para "${search}"` : ""}`
                : "Ainda não há cursos cadastrados"}
          </p>
          <p className={styles.emptyDescription}>
            {showEnrolled
              ? search
                ? "Tente outro termo de busca."
                : "Explore os cursos disponíveis e inscreva-se!"
              : search || tag
                ? "Tente outro termo ou filtro."
                : "Seja o primeiro a criar um curso!"}
          </p>
        </div>
      )}

      {courses.length > 0 && (
        <>
          <ul className={styles.courseGrid}>
            {courses.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </ul>

          {hasMore && !showEnrolled && (
            <div className={styles.loadMore}>
              <button className={styles.btnOutline} disabled={loading} onClick={() => setPage((p) => p + 1)}>
                {loading ? <Spinner size="small" /> : "Carregar mais"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CourseCard({ course }) {
  const tiltRef = useTiltEffect({ max: 8, perspective: 900, scale: 1.02, maxGlare: 0.12 });

  return (
    <li className={styles.courseCard} ref={tiltRef}>
      <Link href={`/estudos/${course.slug}`} className={styles.cardLink}>
        <div className={styles.cardCover}>
          {course.cover_url ? (
            <div style={{ position: "relative", width: "100%", height: "100%" }}>
              <Image
                src={course.cover_url}
                alt=""
                fill
                className={styles.coverImg}
                sizes="(max-width: 600px) 100vw, 300px"
                style={{ objectFit: "cover" }}
              />
            </div>
          ) : (
            <div className={styles.coverPlaceholder}>
              <BookIcon size={32} />
            </div>
          )}
        </div>
        <div className={styles.cardBody}>
          <h3 className={styles.courseName}>{course.title}</h3>
          {course.description && <p className={styles.courseDesc}>{course.description}</p>}
          <div className={styles.cardMeta}>
            <span className={styles.metaItem}>
              <BookIcon size={13} />
              {course.lesson_count ?? 0} {Number(course.lesson_count) === 1 ? "aula" : "aulas"}
            </span>
            {Number(course.avg_rating) > 0 && (
              <span className={styles.metaItem}>
                <StarFillIcon size={13} />
                {Number(course.avg_rating).toFixed(1)}
                {Number(course.rating_count) > 0 && ` (${course.rating_count})`}
              </span>
            )}
          </div>
          <span className={styles.cardAuthor}>por {course.owner_username}</span>
        </div>
      </Link>
    </li>
  );
}
