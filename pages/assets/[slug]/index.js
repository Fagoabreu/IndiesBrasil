import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";
import { Spinner } from "@primer/react";
import { LinkExternalIcon, PencilIcon } from "@primer/octicons-react";

import { useUser } from "@/context/UserContext";
import SeoHead from "@/components/SeoHead";
import AssetCategoryChips from "@/components/Asset/AssetCategoryChips";
import GameReviews from "@/components/GameReviews/GameReviews";
import ContentEngagement from "@/components/ContentEngagement/ContentEngagement";
import { ASSET_LICENSES } from "@/lib/assetLicenses";
import { assetGroupLabel } from "@/lib/assetGroups";
import { SITE_URL, ogImageSizeFromPreset } from "@/lib/seo";
import { breadcrumbList, creativeWork, graph } from "@/lib/structured-data";
import styles from "./asset.module.css";

/**
 * Página do asset.
 *
 * O gate é a mesma feature da rota de detalhe (`read:asset`) — `findBySlug` já
 * esconde asset (e asset de estúdio) bloqueado pela moderação, então o SSR
 * responde `notFound` sem precisar repetir a regra aqui.
 */
export async function getServerSideProps(context) {
  const { slug } = context.params;

  const { anonymousCan } = await import("@/infra/controller");
  if (!anonymousCan("read:asset")) return { notFound: true };

  try {
    const asset = (await import("@/models/asset")).default;
    const row = await asset.findBySlug(slug);

    // node-pg devolve TIMESTAMP como Date — o Next não serializa em props.
    return { props: { initialAsset: JSON.parse(JSON.stringify(row)) } };
  } catch (error) {
    // Inexistente ou bloqueado responde 404 de verdade. Um `initialAsset: null`
    // devolveria 200 com página vazia — o soft 404 que o Search Console reporta
    // e que o visitante lê como "carregando para sempre".
    if (error?.statusCode === 404) return { notFound: true };

    return { props: { initialAsset: null } };
  }
}

export default function AssetPage({ initialAsset }) {
  const router = useRouter();
  const { slug } = router.query;
  const { user, loadingUser } = useUser();

  const [asset, setAsset] = useState(initialAsset ?? null);
  const [loading, setLoading] = useState(!initialAsset);

  // O SSR busca sem sessão; `viewer.canEdit`, `viewer.userReview` e
  // `viewer.likedByUser` só existem na resposta autenticada, então o cliente
  // refaz a consulta quando há usuário logado (e depois de cada interação).
  const fetchAsset = useCallback(async () => {
    if (!slug) return;

    try {
      const response = await fetch(`/api/v1/assets/${slug}`, { credentials: "include" });

      // Asset removido ou bloqueado depois da página carregada: volta para a
      // listagem em vez de deixar a ficha de um conteúdo que não existe mais.
      if (response.status === 404) {
        router.replace("/assets");
        return;
      }

      if (!response.ok) return;
      setAsset(await response.json());
    } catch {
      // Falha de rede não apaga o que já está na tela.
    } finally {
      setLoading(false);
    }
  }, [slug, router]);

  useEffect(() => {
    // `Promise.resolve().then` mantém o `setState` fora do corpo do efeito —
    // `react-hooks/set-state-in-effect` acusa chamada síncrona aqui.
    Promise.resolve().then(fetchAsset);
  }, [fetchAsset, user?.id]);

  if (!initialAsset && (loadingUser || loading)) {
    return (
      <div className={styles.loadingPage}>
        <Spinner size="large" />
      </div>
    );
  }

  if (!asset) return null;

  const canonicalUrl = `${SITE_URL}/assets/${asset.slug}`;
  const license = ASSET_LICENSES[asset.license] ?? ASSET_LICENSES.unknown;
  const ogSize = ogImageSizeFromPreset("mediaCover");
  const categories = Array.isArray(asset.categories) ? asset.categories : [];
  const groupLabels = [...new Set(categories.map((category) => assetGroupLabel(category.group_key)))];

  const keywords = categories.map((category) => category.name);

  return (
    <>
      <SeoHead
        title={`${asset.name} — Indies Brasil`}
        description={asset.short_description || asset.description?.slice(0, 160) || asset.name}
        canonical={canonicalUrl}
        ogImage={asset.cover_url || undefined}
        ogImageWidth={ogSize.width}
        ogImageHeight={ogSize.height}
        ogType="article"
        jsonLd={graph(
          breadcrumbList([
            { name: "Assets", path: "/assets" },
            { name: asset.name, path: `/assets/${asset.slug}` },
          ]),
          creativeWork({
            name: asset.name,
            description: asset.short_description || asset.description,
            image: asset.cover_url,
            url: canonicalUrl,
            creatorName: asset.studio_name,
            creatorUrl: asset.studio_slug ? `${SITE_URL}/estudios/${asset.studio_slug}` : null,
            keywords,
            license: license.url,
            genre: groupLabels.length ? groupLabels.join(", ") : null,
          }),
        )}
      />

      <div className={styles.page}>
        <nav className={styles.breadcrumb}>
          <Link href="/assets">Assets</Link>
          <span> / </span>
          <span>{asset.name}</span>
        </nav>

        <div className={styles.hero}>
          <div className={styles.heroMedia}>
            <div className={styles.heroCoverBox}>
              {asset.cover_url ? (
                <Image src={asset.cover_url} alt={asset.name} fill sizes="(max-width: 800px) 100vw, 560px" className={styles.heroCoverImage} />
              ) : (
                <div className={styles.heroCoverPlaceholder}>
                  <span>{asset.name?.[0]?.toUpperCase() ?? "?"}</span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.heroInfo}>
            <h1 className={styles.name}>{asset.name}</h1>
            {asset.short_description && <p className={styles.tagline}>{asset.short_description}</p>}

            <AssetCategoryChips categories={categories} className={styles.chips} />

            <div className={styles.metaList}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Distribuição</span>
                <span className={asset.is_free ? styles.freeValue : styles.paidValue}>
                  {asset.is_free ? "Gratuito" : asset.price != null ? `R$ ${Number(asset.price).toFixed(2).replace(".", ",")}` : "Pago"}
                </span>
              </div>

              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Licença</span>
                <span className={styles.metaValue}>
                  {license.url ? (
                    <a href={license.url} target="_blank" rel="noopener noreferrer nofollow" className={styles.metaLink}>
                      {license.label}
                    </a>
                  ) : (
                    license.label
                  )}
                </span>
              </div>

              {asset.file_format && (
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Formato</span>
                  <span className={styles.metaValue}>{asset.file_format}</span>
                </div>
              )}

              {asset.source_name && (
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Origem</span>
                  <span className={styles.metaValue}>{asset.source_name}</span>
                </div>
              )}

              {asset.credit && (
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Créditos</span>
                  <span className={styles.metaValue}>{asset.credit}</span>
                </div>
              )}

              {asset.studio_name && (
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Estúdio</span>
                  <Link href={`/estudios/${asset.studio_slug}`} className={styles.metaLink}>
                    {asset.studio_name}
                  </Link>
                </div>
              )}
            </div>

            <div className={styles.actions}>
              {/* O download acontece no endereço de origem — o site referencia. */}
              <a href={asset.external_url} className={styles.primaryAction} target="_blank" rel="noopener noreferrer nofollow">
                Acessar asset <LinkExternalIcon size={14} />
              </a>

              {asset.viewer?.canEdit && (
                <Link href={`/estudios/${asset.studio_slug}/configuracoes?tab=assets`} className={styles.secondaryAction}>
                  <PencilIcon size={14} /> Editar
                </Link>
              )}
            </div>
          </div>
        </div>

        {asset.description && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Sobre este asset</h2>
            <p className={styles.description}>{asset.description}</p>
          </section>
        )}

        {/* Avaliações e interações — ler é público; avaliar, curtir e comentar
            exigem sessão (o formulário de nota mostra o aviso de login e o
            botão de curtir leva para /login). Mesmo comportamento de jogos. */}
        <GameReviews
          reviewsApiUrl={`/api/v1/assets/${slug}/reviews`}
          avgRating={Number(asset.avg_rating ?? 0)}
          reviewCount={Number(asset.review_count ?? 0)}
          userReview={asset.viewer?.userReview ?? null}
          user={user}
          onReviewChange={fetchAsset}
          itemLabel="asset"
        />

        <ContentEngagement
          key={asset.viewer ? "viewer-ready" : "viewer-pending"}
          apiBase={`/api/v1/assets/${slug}`}
          initialLikesCount={asset.viewer?.likesCount ?? 0}
          initialCommentsCount={asset.viewer?.commentsCount ?? 0}
          initialLiked={asset.viewer?.likedByUser ?? false}
          user={user}
        />
      </div>
    </>
  );
}
