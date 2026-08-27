import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { Banner, Button, Heading, Spinner, Textarea } from "@primer/react";
import SeoHead from "@/components/SeoHead";
import AddressFormFields from "@/components/Address/AddressFormFields";
import { useUser } from "@/context/UserContext";
import { formatBRL } from "@/lib/currency";
import { PRODUCT_TYPE_LABELS, STORE_SALES_ENABLED } from "@/lib/store-constants";
import { SITE_URL } from "@/lib/seo";
import styles from "./[slug].module.css";

function ProductGallery({ images, alt }) {
  const [active, setActive] = useState(0);
  const list = images?.length ? images : [];

  if (list.length === 0) {
    return <div className={styles.mediaPlaceholder}>🎁</div>;
  }

  const current = list[Math.min(active, list.length - 1)];

  return (
    <div className={styles.gallery}>
      <div className={styles.galleryMain}>
        {current?.secure_url ? (
          <Image src={current.secure_url} alt={alt} fill sizes="(max-width: 768px) 100vw, 560px" unoptimized />
        ) : (
          <div className={styles.mediaPlaceholder}>🎁</div>
        )}
      </div>
      {list.length > 1 && (
        <div className={styles.thumbs}>
          {list.map((img, index) => (
            <button
              key={img.image_id || index}
              type="button"
              className={`${styles.thumb} ${index === active ? styles.thumbActive : ""}`}
              onClick={() => setActive(index)}
              aria-label={`Imagem ${index + 1}`}
            >
              {img.secure_url ? <Image src={img.secure_url} alt={`${alt} — imagem ${index + 1}`} fill sizes="80px" unoptimized /> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatSavedAddress(addr) {
  const street = [addr.street, addr.number].filter(Boolean).join(", ");
  const cityState = [addr.city, addr.state].filter(Boolean).join(" - ");
  const base = street || cityState;
  return addr.label ? `${addr.label} — ${base}` : base;
}

export default function StoreProductPage() {
  const router = useRouter();
  const { slug } = router.query;
  const { user, loadingUser } = useUser();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [quantity, setQuantity] = useState(1);
  const [buyerNote, setBuyerNote] = useState("");
  const [address, setAddress] = useState({
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zip_code: "",
    country: "Brasil",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [addressMode, setAddressMode] = useState("new");
  const [selectedAddressId, setSelectedAddressId] = useState("");

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

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/user/addresses", { credentials: "include" });
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) {
          setSavedAddresses(data);
        }
      } catch {
        // Caderno de endereços é opcional; falhas são silenciosas.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  function updateAddressField(field, value) {
    setAddress((prev) => ({ ...prev, [field]: value }));
  }

  function changeQuantity(delta) {
    setQuantity((q) => Math.min(99, Math.max(1, q + delta)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        productId: product.id,
        quantity,
        buyerNote: buyerNote.trim() || undefined,
      };
      if (product.type === "physical") {
        const usingSavedAddress = addressMode === "saved" && !!selectedAddressId && !!user?.id;
        if (usingSavedAddress) {
          payload.addressId = selectedAddressId;
        } else {
          payload.address = address;
        }
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
  const hasSavedAddresses = !!user?.id && savedAddresses.length > 0;
  const usingSavedAddress = addressMode === "saved" && !!selectedAddressId && !!user?.id;

  let galleryImages = [];
  if (product.images?.length > 0) {
    galleryImages = product.images;
  } else if (product.image_url) {
    galleryImages = [{ secure_url: product.image_url, image_id: product.image_id }];
  }
  const total = Number(product.price) * quantity;

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
        <div className={styles.main}>
          <div className={styles.badges}>
            <span className={styles.typeBadge}>{PRODUCT_TYPE_LABELS[product.type] || product.type}</span>
            <span className={styles.conditionBadge}>Novo</span>
          </div>

          <Heading as="h1" className={styles.name}>
            {product.name}
          </Heading>

          {product.viewer?.canManage && (
            <Link href={`/estudios/${product.org_slug}/loja`} className={styles.manageLink}>
              Gerenciar produtos do estúdio
            </Link>
          )}

          <ProductGallery images={galleryImages} alt={product.name} />

          <section className={styles.section}>
            <Heading as="h2" className={styles.sectionTitle}>
              Descrição
            </Heading>
            <p className={styles.description}>{product.description || "Este produto ainda não possui uma descrição."}</p>
          </section>

          {product.delivery_notes ? (
            <section className={styles.section}>
              <Heading as="h2" className={styles.sectionTitle}>
                Prazo e entrega
              </Heading>
              <p className={styles.description}>{product.delivery_notes}</p>
            </section>
          ) : null}
        </div>

        <aside className={styles.buyBox}>
          <div className={styles.buyBoxInner}>
            <span className={styles.price}>{formatBRL(product.price)}</span>
            <span className={styles.installment}>em até 1x sem juros no boleto ou Pix</span>

            <Link href={`/estudios/${product.org_slug}`} className={styles.seller}>
              {product.org_logo_url ? <Image src={product.org_logo_url} alt={product.org_name} width={32} height={32} unoptimized /> : null}
              <span>
                Vendido por <strong>{product.org_name}</strong>
              </span>
            </Link>

            {!salesEnabled && (
              <Banner variant="warning" title="Loja em fase de testes">
                As vendas estão temporariamente desabilitadas e os pedidos ainda não têm validade comercial.
              </Banner>
            )}

            {success ? (
              <div className={styles.successBox}>
                <Banner variant="success">Pedido enviado com sucesso! O estúdio entrará em contato para combinar o pagamento e a entrega.</Banner>
                <Button as={Link} href="/loja/pedidos" variant="primary" block>
                  Ver meus pedidos
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className={styles.form}>
                {salesEnabled && !user?.id && !loadingUser && (
                  <Banner variant="warning">
                    <Link href="/login">Entre na sua conta</Link> para fazer um pedido.
                  </Banner>
                )}

                <div className={styles.quantityRow}>
                  <span className={styles.quantityLabel}>Quantidade</span>
                  <div className={styles.stepper}>
                    <button
                      type="button"
                      className={styles.stepperBtn}
                      onClick={() => changeQuantity(-1)}
                      disabled={!canBuy || submitting}
                      aria-label="Diminuir quantidade"
                    >
                      −
                    </button>
                    <span className={styles.stepperValue}>{quantity}</span>
                    <button
                      type="button"
                      className={styles.stepperBtn}
                      onClick={() => changeQuantity(1)}
                      disabled={!canBuy || submitting}
                      aria-label="Aumentar quantidade"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className={styles.totalRow}>
                  <span>Total</span>
                  <span className={styles.totalValue}>{formatBRL(total)}</span>
                </div>

                {isPhysical && (
                  <div className={styles.addressFields}>
                    <Heading as="h2" className={styles.sectionTitle}>
                      Endereço de entrega
                    </Heading>
                    {hasSavedAddresses && (
                      <div className={styles.savedAddressField}>
                        <label className={styles.noteLabel} htmlFor="saved_address">
                          Endereço salvo
                        </label>
                        <select
                          id="saved_address"
                          className={styles.savedAddressSelect}
                          value={addressMode === "saved" ? selectedAddressId : ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value) {
                              setAddressMode("saved");
                              setSelectedAddressId(value);
                            } else {
                              setAddressMode("new");
                              setSelectedAddressId("");
                            }
                          }}
                          disabled={!canBuy || submitting}
                        >
                          <option value="">+ Usar novo endereço</option>
                          {savedAddresses.map((addr) => (
                            <option key={addr.address_id} value={addr.address_id}>
                              {formatSavedAddress(addr)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {!usingSavedAddress && <AddressFormFields value={address} onChange={updateAddressField} disabled={!canBuy || submitting} />}
                  </div>
                )}

                <div className={styles.noteField}>
                  <label className={styles.noteLabel} htmlFor="buyer_note">
                    Observações para o estúdio
                  </label>
                  <Textarea
                    id="buyer_note"
                    value={buyerNote}
                    onChange={(e) => setBuyerNote(e.target.value)}
                    placeholder="Opcional — detalhes sobre o pedido..."
                    disabled={!canBuy || submitting}
                  />
                </div>

                {error ? <Banner variant="danger">{error}</Banner> : null}

                <Button type="submit" variant="primary" size="large" block disabled={!canBuy || submitting}>
                  {submitting ? "Enviando..." : "Fazer pedido"}
                </Button>
                <p className={styles.disclaimer}>
                  A plataforma apenas registra o pedido. O pagamento e a entrega são combinados diretamente com o estúdio.
                </p>
              </form>
            )}

            <div className={styles.trustBadges}>
              <div className={styles.trustItem}>
                <span className={styles.trustIcon}>🚚</span>
                <span>Entrega combinada com o estúdio</span>
              </div>
              <div className={styles.trustItem}>
                <span className={styles.trustIcon}>🛡️</span>
                <span>Compra registrada pela plataforma</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
