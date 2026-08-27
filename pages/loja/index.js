import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Banner, Button, Heading, Spinner, TextInput } from "@primer/react";
import { SearchIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import { formatBRL } from "@/lib/currency";
import { PRODUCT_TYPE_LABELS, STORE_SALES_ENABLED } from "@/lib/store-constants";
import { SITE_URL } from "@/lib/seo";
import styles from "./index.module.css";

const PAGE_TITLE = "Loja — Indies Brasil";
const PAGE_DESCRIPTION = "Produtos e merch de estúdios indie brasileiros. A venda é feita diretamente pelo estúdio.";
const PAGE_URL = `${SITE_URL}/loja`;

export default function StorePage() {
  const { user } = useUser();

  const [search, setSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  async function loadProducts(pageNum, searchQuery) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pageNum, limit: 24, search: searchQuery });
      const res = await fetch(`/api/v1/store/products?${params}`, { credentials: "include" });
      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      setProducts((prev) => (pageNum === 1 ? rows : [...prev, ...rows]));
      setHasMore(rows.length === 24);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      loadProducts(1, search);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    loadProducts(next, search);
  }, [page, search]);

  function renderContent() {
    if (loading && products.length === 0) {
      return (
        <div className={styles.empty}>
          <Spinner size="medium" />
          <p>Carregando produtos...</p>
        </div>
      );
    }

    if (products.length === 0) {
      return (
        <div className={styles.empty}>
          <p>Nenhum produto encontrado.</p>
        </div>
      );
    }

    return (
      <>
        <div className={styles.grid}>
          {products.map((product) => (
            <Link key={product.id} href={`/loja/${product.slug}`} className={styles.card}>
              <div className={styles.cardImage}>
                {product.image_url ? (
                  <Image src={product.image_url} alt={product.name} fill sizes="(max-width: 640px) 50vw, 300px" unoptimized />
                ) : (
                  <div className={styles.cardImagePlaceholder}>🎁</div>
                )}
                <span className={styles.typeBadge}>{PRODUCT_TYPE_LABELS[product.type] || product.type}</span>
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}>{product.name}</h3>
                <span className={styles.price}>{formatBRL(product.price)}</span>
                <span className={styles.installment}>em até 1x sem juros</span>
                <div className={styles.cardOrg}>
                  {product.org_logo_url ? <Image src={product.org_logo_url} alt={product.org_name} width={18} height={18} unoptimized /> : null}
                  <span>{product.org_name}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {hasMore && (
          <div className={styles.loadMore}>
            <Button onClick={loadMore} disabled={loading}>
              {loading ? "Carregando..." : "Carregar mais"}
            </Button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className={styles.page}>
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical={PAGE_URL} />

      <div className={styles.header}>
        <Heading as="h1" className={styles.title}>
          Loja
        </Heading>
        <p className={styles.subtitle}>Produtos e merch de estúdios indie brasileiros. A compra é combinada diretamente com o estúdio.</p>
        {user && (
          <div className={styles.myOrders}>
            <Button as={Link} href="/loja/pedidos">
              Meus pedidos
            </Button>
          </div>
        )}
      </div>

      {!STORE_SALES_ENABLED && (
        <Banner variant="warning" title="Loja em fase de testes">
          As vendas estão temporariamente desabilitadas e ainda não têm validade comercial.
        </Banner>
      )}

      <div className={styles.searchRow}>
        <TextInput
          leadingVisual={SearchIcon}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar produtos..."
          aria-label="Buscar produtos"
          block
        />
      </div>

      {renderContent()}
    </div>
  );
}
