import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";
import { Banner, Heading, Spinner } from "@primer/react";
import SeoHead from "@/components/SeoHead";
import { formatBRL } from "@/lib/currency";
import { ORDER_STATUS_LABELS } from "@/lib/store-constants";
import { SITE_URL } from "@/lib/seo";
import styles from "./pedidos.module.css";

export async function getServerSideProps(context) {
  const { slug } = context.params;
  try {
    const organization = (await import("@/models/organization")).default;
    const studio = await organization.findBySlug(slug);
    if (!studio) return { props: { notFound: true } };
    return { props: { studio: JSON.parse(JSON.stringify(studio)) } };
  } catch {
    return { props: { notFound: true } };
  }
}

export default function StudioOrdersPage({ studio, notFound }) {
  const router = useRouter();
  const { slug } = router.query;

  const [viewer, setViewer] = useState(null);
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    fetch(`/api/v1/studios/${encodeURIComponent(slug)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setViewer(data.viewer || {});
      })
      .catch(() => {
        if (!cancelled) setViewer({});
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const isMember = viewer?.isMember || viewer?.isAdmin || viewer?.isOwner;

  useEffect(() => {
    if (!slug || !isMember) return;
    let cancelled = false;
    fetch(`/api/v1/store/orders?org=${encodeURIComponent(slug)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setOrders(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) {
          setOrders([]);
          setError("Não foi possível carregar os pedidos.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug, isMember]);

  if (notFound) {
    return (
      <div className={styles.page}>
        <SeoHead title="Estúdio não encontrado — Indies Brasil" description="Estúdio não encontrado." canonical={`${SITE_URL}/estudios`} noIndex />
        <Banner variant="critical" title="Estúdio não encontrado">
          Estúdio não encontrado.
        </Banner>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <SeoHead
        title={`Pedidos de ${studio.name} — Indies Brasil`}
        description={`Pedidos recebidos na loja do estúdio ${studio.name}.`}
        canonical={`${SITE_URL}/estudios/${studio.slug}/pedidos`}
        noIndex
      />

      <div className={styles.header}>
        <Link href={`/estudios/${studio.slug}`} className={styles.backLink}>
          ← Voltar ao estúdio
        </Link>
        <Heading as="h1" className={styles.title}>
          Pedidos de {studio.name}
        </Heading>
      </div>

      {viewer === null ? (
        <div className={styles.centered}>
          <Spinner size="medium" />
        </div>
      ) : !isMember ? (
        <Banner variant="critical" title="Acesso restrito">
          Apenas membros do estúdio podem ver os pedidos.
        </Banner>
      ) : (
        <>
          {error ? <Banner variant="danger">{error}</Banner> : null}

          {orders === null ? (
            <div className={styles.centered}>
              <Spinner size="medium" />
            </div>
          ) : orders.length === 0 ? (
            <p className={styles.empty}>Nenhum pedido recebido ainda.</p>
          ) : (
            <div className={styles.list}>
              {orders.map((order) => (
                <div key={order.id} className={styles.orderCard}>
                  <div className={styles.orderImage}>
                    {order.product_image_url ? (
                      <Image src={order.product_image_url} alt={order.product_name || ""} fill sizes="80px" unoptimized />
                    ) : (
                      <div className={styles.orderImagePlaceholder}>🎁</div>
                    )}
                  </div>
                  <div className={styles.orderInfo}>
                    <span className={styles.orderProduct}>{order.product_name || "Produto removido"}</span>
                    <span className={styles.orderBuyer}>Comprador: {order.buyer_username || "—"}</span>
                    <span className={styles.orderMeta}>
                      {order.quantity} un. · Total {formatBRL(order.total)}
                    </span>
                    {order.delivery_deadline_days != null ? (
                      <span className={styles.orderMeta}>Prazo estimado: {order.delivery_deadline_days} dias</span>
                    ) : null}
                    <span className={styles.orderMeta}>Pedido em {new Date(order.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                  <div className={styles.orderSide}>
                    <span className={styles.statusBadge}>{ORDER_STATUS_LABELS[order.status] || order.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
