import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Banner, Button, Heading, Spinner } from "@primer/react";
import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import { formatBRL } from "@/lib/currency";
import { BUYER_CANCELLABLE_STATUSES, ORDER_STATUS_LABELS } from "@/lib/store-constants";
import { SITE_URL } from "@/lib/seo";
import styles from "./pedidos.module.css";

const PAGE_TITLE = "Meus pedidos — Indies Brasil";
const PAGE_DESCRIPTION = "Acompanhe os pedidos feitos na loja de estúdios indie brasileiros.";
const PAGE_URL = `${SITE_URL}/loja/pedidos`;

export default function MyOrdersPage() {
  const { user, loadingUser } = useUser();

  const [orders, setOrders] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    const res = await fetch("/api/v1/store/orders", { credentials: "include" });
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }, []);

  useEffect(() => {
    if (!user) return;
    let ignore = false;
    loadOrders()
      .then((data) => {
        if (!ignore) setOrders(data);
      })
      .catch(() => {
        if (!ignore) setOrders([]);
      });
    return () => {
      ignore = true;
    };
  }, [user, loadOrders]);

  async function cancelOrder(order) {
    setCancellingId(order.id);
    setError("");
    try {
      const res = await fetch(`/api/v1/store/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (res.ok) {
        try {
          setOrders(await loadOrders());
        } catch {
          // A atualização da lista falhou, mas o pedido já foi cancelado.
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Não foi possível cancelar o pedido.");
      }
    } catch {
      setError("Não foi possível cancelar o pedido.");
    } finally {
      setCancellingId(null);
    }
  }

  if (loadingUser) {
    return (
      <div className={styles.centered}>
        <Spinner size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.page}>
        <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical={PAGE_URL} noIndex />
        <Banner variant="warning">
          <Link href="/login">Entre na sua conta</Link> para ver seus pedidos.
        </Banner>
      </div>
    );
  }

  const isLoading = orders === null;

  function renderOrders() {
    if (isLoading) {
      return (
        <div className={styles.centered}>
          <Spinner size="medium" />
        </div>
      );
    }

    if (orders.length === 0) {
      return (
        <div className={styles.empty}>
          <p>Você ainda não fez nenhum pedido.</p>
          <Button as={Link} href="/loja">
            Explorar a loja
          </Button>
        </div>
      );
    }

    return (
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
              <Link href={`/loja/${order.product_slug || order.product_id}`} className={styles.orderProduct}>
                {order.product_name || "Produto removido"}
              </Link>
              <span className={styles.orderOrg}>{order.org_name}</span>
              <span className={styles.orderMeta}>
                {order.quantity} un. · Total {formatBRL(order.total)}
              </span>
              {order.delivery_deadline_days != null ? (
                <span className={styles.orderMeta}>Prazo estimado: {order.delivery_deadline_days} dias</span>
              ) : null}
            </div>
            <div className={styles.orderSide}>
              <span className={styles.statusBadge}>{ORDER_STATUS_LABELS[order.status] || order.status}</span>
              {BUYER_CANCELLABLE_STATUSES.includes(order.status) && (
                <Button size="small" variant="danger" onClick={() => cancelOrder(order)} disabled={cancellingId === order.id}>
                  {cancellingId === order.id ? "Cancelando..." : "Cancelar"}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical={PAGE_URL} noIndex />

      <Heading as="h1" className={styles.title}>
        Meus pedidos
      </Heading>

      {error ? <Banner variant="danger">{error}</Banner> : null}

      {renderOrders()}
    </div>
  );
}
