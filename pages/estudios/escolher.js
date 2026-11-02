import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Avatar, Heading, Spinner, Flash } from "@primer/react";
import { ArrowLeftIcon, OrganizationIcon, PlusIcon } from "@primer/octicons-react";

import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import { STUDIO_PRODUCT_TABS, canEditStudio } from "@/lib/studioEntry";
import styles from "./escolher.module.css";

/**
 * Seletor de estúdio para quem administra mais de um.
 *
 * Existe porque "publicar" não é uma ação do usuário, é uma ação **do estúdio**:
 * quem responde por dois estúdios precisa dizer qual deles antes de abrir o
 * formulário. Antes o botão "Oferecer serviços" levava a uma aba arbitrária (ou
 * à lista de estúdios, que não é seletor), e a pessoa só descobria que estava
 * no estúdio errado depois de salvar.
 *
 * A aba escolhida vem na query (`?tab=services`) e é preservada em cada card:
 * esta página decide **onde**, não **o que**.
 *
 * `noIndex`: é etapa de operação, não conteúdo.
 */

/** Rótulo da aba — a query é técnica, o texto é o que a pessoa escolheu. */
const TAB_LABELS = {
  games: "Jogos",
  boardgames: "Jogos de Mesa",
  books: "Publicações",
  assets: "Assets",
  streaming: "Streaming",
  services: "Serviços",
};

export default function EscolherEstudioPage() {
  const router = useRouter();
  const { user, loadingUser } = useUser();

  const requestedTab = typeof router.query.tab === "string" ? router.query.tab : "";
  const tab = STUDIO_PRODUCT_TABS[requestedTab] ? requestedTab : "";

  const [studios, setStudios] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (loadingUser || !user?.id) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/v1/studios?member=me", { credentials: "include" });
        if (!res.ok) throw new Error("Não foi possível carregar os seus estúdios.");
        const data = await res.json();
        if (!cancelled) setStudios(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setStudios([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, loadingUser]);

  // Sem sessão não há estúdio para escolher — e voltar para cá depois do login é
  // o que evita perder a intenção de publicar.
  if (!loadingUser && !user) {
    return (
      <div className={styles.page}>
        <SeoHead title="Escolher estúdio — Indies Brasil" noIndex />
        <Flash variant="warning">
          <Link href={`/login?next=${encodeURIComponent(router.asPath)}`}>Entre na sua conta</Link> para escolher o estúdio.
        </Flash>
      </div>
    );
  }

  const editable = Array.isArray(studios) ? studios.filter(canEditStudio) : [];
  const readOnly = Array.isArray(studios) ? studios.filter((studio) => !canEditStudio(studio)) : [];

  return (
    <>
      <SeoHead title="Escolher estúdio — Indies Brasil" description="Escolha em qual estúdio você vai publicar." noIndex />

      <div className={styles.page}>
        <Link href="/estudios?member=me" className={styles.backLink}>
          <ArrowLeftIcon size={14} /> Meus estúdios
        </Link>

        <Heading as="h1" className={styles.title}>
          Em qual estúdio você vai publicar?
        </Heading>
        <p className={styles.subtitle}>
          {tab
            ? `Você está a caminho da aba ${TAB_LABELS[tab] ?? tab}. Escolha o estúdio que assina a publicação.`
            : "Escolha o estúdio que assina a publicação."}
        </p>

        {error && <Flash variant="danger">{error}</Flash>}

        {studios === null ? (
          <div className={styles.loading}>
            <Spinner size="medium" />
          </div>
        ) : studios.length === 0 ? (
          <div className={styles.empty}>
            <OrganizationIcon size={32} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>Você ainda não participa de nenhum estúdio</p>
            <p className={styles.emptyText}>Todo conteúdo é publicado por um estúdio. Crie o seu para começar.</p>
            <Link href="/estudios/novo" className={styles.primaryAction}>
              <PlusIcon size={14} /> Criar estúdio
            </Link>
          </div>
        ) : (
          <>
            {editable.length > 0 && (
              <ul className={styles.list}>
                {editable.map((studio) => (
                  <li key={studio.id}>
                    <Link href={`/estudios/${studio.slug}/configuracoes${tab ? `?tab=${tab}` : ""}`} className={styles.card}>
                      <Avatar src={studio.logo_url || "/images/studio.jpg"} size={40} alt="" className={styles.logo} />
                      <span className={styles.cardBody}>
                        <span className={styles.cardName}>{studio.name}</span>
                        <span className={styles.cardRole}>{studio.role === "owner" ? "Responsável" : "Administrador"}</span>
                      </span>
                      <span className={styles.cardAction}>Publicar →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {/* Estúdios em que a pessoa é só membro: aparecem porque ela
                participa deles, mas publicar exige dono ou administrador — o
                servidor recusa (`assertCanEdit`). Escondê-los faria o estúdio
                "sumir" da lista de quem é membro. */}
            {readOnly.length > 0 && (
              <section className={styles.readOnlySection}>
                <p className={styles.readOnlyTitle}>Onde você é membro</p>
                <p className={styles.readOnlyHint}>Publicar exige ser responsável ou administrador do estúdio.</p>

                <ul className={styles.list}>
                  {readOnly.map((studio) => (
                    <li key={studio.id}>
                      <div className={`${styles.card} ${styles.cardDisabled}`}>
                        <Avatar src={studio.logo_url || "/images/studio.jpg"} size={40} alt="" className={styles.logo} />
                        <span className={styles.cardBody}>
                          <span className={styles.cardName}>{studio.name}</span>
                          <span className={styles.cardRole}>Membro</span>
                        </span>
                        <span className={styles.cardActionMuted}>Sem permissão</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {editable.length === 0 && readOnly.length > 0 && (
              <p className={styles.footerHint}>
                Você precisa ser responsável ou administrador para publicar. Peça a quem administra o estúdio para conceder o acesso, ou{" "}
                <Link href="/estudios/novo" className={styles.inlineLink}>
                  crie o seu próprio
                </Link>
                .
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
