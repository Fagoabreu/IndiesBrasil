import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { Banner, Button, FormControl, Heading, Spinner, TextInput, Textarea } from "@primer/react";
import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import { formatBRL } from "@/lib/currency";
import { PRODUCT_TYPE_LABELS, STORE_SALES_ENABLED } from "@/lib/store-constants";
import { SITE_URL } from "@/lib/seo";
import styles from "./[slug].module.css";

export default function StoreProductPage() {
  const router = useRouter();
  const { slug } = router.query;
  const { user, loadingUser } = useUser();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [quantity, setQuantity] = useState("1");
  const [buyerNote, setBuyerNote] = useState("");
  const [address, setAddress] = useState({
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zip_code: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/store/products/${encodeURIComponent(slug)}`, {
          credentials: "include",
        });
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const data = await res.json();
        if (!cancelled) setProduct(data);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  function updateAddressField(field, value) {
    setAddress((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        productId: product.id,
        quantity: Number(quantity),
        buyerNote: buyerNote.trim() || undefined,
      };
      if (product.type === "physical") {
        payload.address = address;
      }

      const res = await fetch("/api/v1/store/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccess(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Não foi possível enviar o pedido.");
      }
    } catch {
      setError("Não foi possível enviar o pedido.");
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <div className={styles.page}>
        <SeoHead title="Produto não encontrado — Indies Brasil" description="Produto não encontrado." canonical={`${SITE_URL}/loja`} noIndex />
        <Banner variant="danger">Produto não encontrado.</Banner>
      </div>
    );
  }

  if (loading || !product) {
    return (
      <div className={styles.centered}>
        <Spinner size="large" />
      </div>
    );
  }

  const isPhysical = product.type === "physical";
  const salesEnabled = STORE_SALES_ENABLED;
  const canBuy = salesEnabled && !!user?.id;

  return (
    <div className={styles.page}>
      <SeoHead
        title={`${product.name} — Loja Indies Brasil`}
        description={product.description || `Compre ${product.name} na loja de ${product.org_name}.`}
        canonical={`${SITE_URL}/loja/${product.slug}`}
        ogImage={product.image_url || undefined}
        ogType="product"
      />

      <div className={styles.breadcrumb}>
        <Link href="/loja">Loja</Link>
        <span> / </span>
        <span>{product.name}</span>
      </div>

      <div className={styles.layout}>
        <div className={styles.media}>
          {product.image_url ? (
            <Image src={product.image_url} alt={product.name} fill sizes="(max-width: 768px) 100vw, 560px" unoptimized />
          ) : (
            <div className={styles.mediaPlaceholder}>🎁</div>
          )}
        </div>

        <div className={styles.details}>
          <div className={styles.badges}>
            <span className={styles.typeBadge}>{PRODUCT_TYPE_LABELS[product.type] || product.type}</span>
          </div>
          <Heading as="h1" className={styles.name}>
            {product.name}
          </Heading>

          <Link href={`/estudios/${product.org_slug}`} className={styles.studio}>
            {product.org_logo_url ? <Image src={product.org_logo_url} alt={product.org_name} width={28} height={28} unoptimized /> : null}
            <span>{product.org_name}</span>
          </Link>

          <span className={styles.price}>{formatBRL(product.price)}</span>

          {product.description ? <p className={styles.description}>{product.description}</p> : null}

          {product.delivery_notes ? (
            <p className={styles.deliveryNotes}>
              <strong>Prazo e entrega:</strong> {product.delivery_notes}
            </p>
          ) : null}

          {product.viewer?.canManage && (
            <div className={styles.manageLink}>
              <Button as={Link} href={`/estudios/${product.org_slug}/loja`} variant="invisible">
                Gerenciar produtos do estúdio
              </Button>
            </div>
          )}

          {!salesEnabled && (
            <Banner variant="warning" title="Loja em fase de testes">
              As vendas estão temporariamente desabilitadas e os pedidos ainda não têm validade comercial.
            </Banner>
          )}

          {success ? (
            <Banner variant="success">
              Pedido enviado com sucesso! O estúdio entrará em contato para combinar o pagamento e a entrega.
              <div className={styles.successActions}>
                <Button as={Link} href="/loja/pedidos">
                  Ver meus pedidos
                </Button>
              </div>
            </Banner>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form}>
              {salesEnabled && !user?.id && !loadingUser && (
                <Banner variant="warning">
                  <Link href="/login">Entre na sua conta</Link> para fazer um pedido.
                </Banner>
              )}

              <FormControl required>
                <FormControl.Label>Quantidade</FormControl.Label>
                <TextInput type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={!canBuy || submitting} />
              </FormControl>

              {isPhysical && (
                <div className={styles.addressFields}>
                  <Heading as="h2" className={styles.sectionTitle}>
                    Endereço de entrega
                  </Heading>
                  <div className={styles.addressGrid}>
                    <FormControl required>
                      <FormControl.Label>Logradouro</FormControl.Label>
                      <TextInput
                        value={address.street}
                        onChange={(e) => updateAddressField("street", e.target.value)}
                        placeholder="Rua / Avenida"
                        disabled={!canBuy || submitting}
                      />
                    </FormControl>
                    <FormControl>
                      <FormControl.Label>Número</FormControl.Label>
                      <TextInput
                        value={address.number}
                        onChange={(e) => updateAddressField("number", e.target.value)}
                        disabled={!canBuy || submitting}
                      />
                    </FormControl>
                    <FormControl>
                      <FormControl.Label>Complemento</FormControl.Label>
                      <TextInput
                        value={address.complement}
                        onChange={(e) => updateAddressField("complement", e.target.value)}
                        disabled={!canBuy || submitting}
                      />
                    </FormControl>
                    <FormControl>
                      <FormControl.Label>Bairro</FormControl.Label>
                      <TextInput
                        value={address.neighborhood}
                        onChange={(e) => updateAddressField("neighborhood", e.target.value)}
                        disabled={!canBuy || submitting}
                      />
                    </FormControl>
                    <FormControl required>
                      <FormControl.Label>Cidade</FormControl.Label>
                      <TextInput value={address.city} onChange={(e) => updateAddressField("city", e.target.value)} disabled={!canBuy || submitting} />
                    </FormControl>
                    <FormControl required>
                      <FormControl.Label>UF</FormControl.Label>
                      <TextInput
                        value={address.state}
                        onChange={(e) => updateAddressField("state", e.target.value)}
                        placeholder="SP"
                        maxLength={2}
                        disabled={!canBuy || submitting}
                      />
                    </FormControl>
                    <FormControl>
                      <FormControl.Label>CEP</FormControl.Label>
                      <TextInput
                        value={address.zip_code}
                        onChange={(e) => updateAddressField("zip_code", e.target.value)}
                        placeholder="00000-000"
                        disabled={!canBuy || submitting}
                      />
                    </FormControl>
                  </div>
                </div>
              )}

              <FormControl>
                <FormControl.Label>Observações para o estúdio</FormControl.Label>
                <Textarea
                  value={buyerNote}
                  onChange={(e) => setBuyerNote(e.target.value)}
                  placeholder="Opcional — detalhes sobre o pedido..."
                  disabled={!canBuy || submitting}
                />
              </FormControl>

              {error ? <Banner variant="danger">{error}</Banner> : null}

              <Button type="submit" variant="primary" disabled={!canBuy || submitting}>
                {submitting ? "Enviando..." : "Fazer pedido"}
              </Button>
              <p className={styles.disclaimer}>
                A plataforma apenas registra o pedido. O pagamento e a entrega são combinados diretamente com o estúdio.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
