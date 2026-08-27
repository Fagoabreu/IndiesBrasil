import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";
import { Banner, Button, FormControl, Heading, Select, Spinner, TextInput, Textarea } from "@primer/react";
import SeoHead from "@/components/SeoHead";
import ImageCropModal from "@/components/ImageTools/ImageCropTool/ImageCropModal";
import { formatBRL } from "@/lib/currency";
import { ORDER_STATUS_LABELS, ORDER_STATUSES, PRODUCT_TYPE_LABELS, PRODUCT_TYPES } from "@/lib/store-constants";
import { SITE_URL } from "@/lib/seo";
import styles from "./loja.module.css";

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

export async function getServerSideProps(context) {
  const { slug } = context.params;
  try {
    const organization = (await import("@/models/organization")).default;
    const store = (await import("@/models/store")).default;
    const studio = await organization.findBySlug(slug);
    const eligible = await organization.isStoreEligible(studio);
    const products = await store.findProductsByOrg(studio.id);

    // Serialize Date objects to ISO strings — node-pg returns TIMESTAMP
    // columns as Date objects, which Next.js cannot serialize in props.
    const serializedStudio = JSON.parse(JSON.stringify(studio));
    const serializedProducts = JSON.parse(JSON.stringify(products));

    return {
      props: {
        initialStudio: serializedStudio,
        initialEligible: eligible,
        initialProducts: serializedProducts,
      },
    };
  } catch {
    return { props: { notFound: true } };
  }
}

export default function StudioStorePage({ initialStudio, initialEligible, initialProducts, notFound }) {
  const router = useRouter();
  const { slug } = router.query;

  const [viewer, setViewer] = useState(null);
  const [products, setProducts] = useState(initialProducts || []);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);

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

  const canManage = viewer?.isOwner || viewer?.isAdmin;

  async function reloadProducts() {
    const res = await fetch(`/api/v1/store/products?org=${encodeURIComponent(slug)}`, {
      credentials: "include",
    });
    const data = await res.json();
    setProducts(Array.isArray(data) ? data : []);
  }

  async function handleEdit(product) {
    const res = await fetch(`/api/v1/store/products/${encodeURIComponent(product.slug)}`, {
      credentials: "include",
    });
    const data = await res.json().catch(() => product);
    setEditingProduct(res.ok ? data : product);
  }

  useEffect(() => {
    if (!canManage) return;
    let ignore = false;
    fetch(`/api/v1/store/orders?org=${encodeURIComponent(slug)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!ignore) setOrders(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!ignore) setOrders([]);
      })
      .finally(() => {
        if (!ignore) setOrdersLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [canManage, slug]);

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

  function renderOrders() {
    if (ordersLoading) {
      return <Spinner size="medium" />;
    }
    if (orders.length === 0) {
      return <p className={styles.empty}>Nenhum pedido recebido ainda.</p>;
    }
    return (
      <div className={styles.orderList}>
        {orders.map((order) => (
          <OrderRow key={order.id} order={order} />
        ))}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <SeoHead
        title={`Loja de ${initialStudio.name} — Indies Brasil`}
        description={`Produtos e pedidos da loja do estúdio ${initialStudio.name}.`}
        canonical={`${SITE_URL}/estudios/${initialStudio.slug}/loja`}
        noIndex={canManage}
      />

      <div className={styles.header}>
        <Link href={`/estudios/${initialStudio.slug}`} className={styles.backLink}>
          ← Voltar ao estúdio
        </Link>
        <Heading as="h1" className={styles.title}>
          Loja de {initialStudio.name}
        </Heading>
      </div>

      {!initialEligible && (
        <Banner variant="warning" title="Estúdio não apto para vender na loja">
          Este estúdio ainda não está apto a vender na loja. Para liberar a vitrine, é necessário ter CNPJ válido, endereço completo e ao menos um
          contato cadastrados e validados nas configurações do estúdio.
        </Banner>
      )}

      {canManage && (
        <ProductForm
          key={editingProduct ? editingProduct.slug : "new"}
          studioId={initialStudio.id}
          editingProduct={editingProduct}
          onSaved={() => {
            setEditingProduct(null);
            reloadProducts();
          }}
          onCancelEdit={() => setEditingProduct(null)}
          disabled={!initialEligible}
        />
      )}

      <section className={styles.section}>
        <Heading as="h2" className={styles.sectionTitle}>
          Produtos
        </Heading>
        {products.length === 0 ? (
          <p className={styles.empty}>Nenhum produto cadastrado ainda.</p>
        ) : (
          <div className={styles.grid}>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} canManage={canManage} onEdit={handleEdit} onChanged={reloadProducts} />
            ))}
          </div>
        )}
      </section>

      {canManage && (
        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>
            Pedidos recebidos
          </Heading>
          {renderOrders()}
        </section>
      )}
    </div>
  );
}

function ProductCard({ product, canManage, onChanged, onEdit }) {
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm(`Excluir o produto "${product.name}"?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/v1/store/products/${encodeURIComponent(product.slug)}`, {
        method: "DELETE",
        credentials: "include",
      });
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.productCard}>
      <div className={styles.productImage}>
        {product.image_url ? (
          <Image src={product.image_url} alt={product.name} fill sizes="200px" unoptimized />
        ) : (
          <div className={styles.productImagePlaceholder}>🎁</div>
        )}
      </div>
      <div className={styles.productBody}>
        <div className={styles.productTop}>
          <span className={styles.typeBadge}>{PRODUCT_TYPE_LABELS[product.type] || product.type}</span>
          {product.status !== "active" && <span className={styles.inactiveBadge}>Inativo</span>}
        </div>
        <h3 className={styles.productName}>{product.name}</h3>
        <span className={styles.productPrice}>{formatBRL(product.price)}</span>
        {canManage && (
          <div className={styles.productActions}>
            <Link href={`/loja/${product.slug}`} className={styles.viewLink}>
              Ver
            </Link>
            <Button size="small" onClick={() => onEdit(product)} disabled={busy}>
              Editar
            </Button>
            <Button size="small" variant="danger" onClick={remove} disabled={busy}>
              {busy ? "..." : "Excluir"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductForm({ studioId, editingProduct, onSaved, onCancelEdit, disabled }) {
  // Remontado via `key` quando o produto em edição muda, então os valores
  // iniciais refletem `editingProduct` sem precisar de useEffect.
  const [open, setOpen] = useState(Boolean(editingProduct));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: editingProduct?.name || "",
    type: editingProduct?.type || "physical",
    price: editingProduct?.price != null ? String(editingProduct.price) : "",
    description: editingProduct?.description || "",
    deliveryNotes: editingProduct?.delivery_notes || "",
  });
  // As imagens recortadas ficam apenas em memória (data URL) e são enviadas
  // junto com o produto no momento de salvar — assim nada vai ao Cloudinary
  // antes da confirmação e não sobra imagem órfã. A primeira imagem é a capa.
  const [images, setImages] = useState(() => {
    if (editingProduct?.images?.length) {
      return editingProduct.images.map((img) => ({ id: img.image_id, preview: img.secure_url }));
    }
    if (editingProduct?.image_url) {
      return [{ id: editingProduct.image_id, preview: editingProduct.image_url }];
    }
    return [];
  });
  const [cropQueue, setCropQueue] = useState([]);
  const [cropSrc, setCropSrc] = useState(null);
  const fileInputRef = useRef(null);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleCancelEdit() {
    setOpen(false);
    setForm({ name: "", type: "physical", price: "", description: "", deliveryNotes: "" });
    setImages([]);
    setCropQueue([]);
    setCropSrc(null);
    onCancelEdit();
  }

  function openImagePicker() {
    fileInputRef.current?.click();
  }

  function handleImageFileChange(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;

    // Lê todos os arquivos e os enfileira para recorte sequencial.
    Promise.all(files.map(readFileAsDataUrl)).then((dataUrls) => {
      setCropQueue(dataUrls);
      setCropSrc(dataUrls[0] || null);
    });
  }

  async function handleImageCropConfirm(blob) {
    if (blob) {
      const dataUrl = await readFileAsDataUrl(blob);
      setImages((prev) => [...prev, { dataUrl, preview: dataUrl }]);
    }
    advanceCropQueue();
  }

  function handleCropClose() {
    advanceCropQueue();
  }

  function advanceCropQueue() {
    setCropSrc(null);
    const rest = cropQueue.slice(1);
    setCropQueue(rest);
    if (rest.length > 0) {
      setCropSrc(rest[0]);
    }
  }

  function removeImageAt(index) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  function moveImage(index, delta) {
    setImages((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");

    const payload = {
      name: form.name,
      type: form.type,
      price: form.price,
      description: form.description || undefined,
      deliveryNotes: form.deliveryNotes || undefined,
    };

    payload.images = images.map((img) => (img.id ? { id: img.id } : img.dataUrl));

    try {
      const res = editingProduct
        ? await fetch(`/api/v1/store/products/${encodeURIComponent(editingProduct.slug)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
          })
        : await fetch("/api/v1/store/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ organizationId: studioId, ...payload }),
          });

      if (res.ok) {
        setForm({ name: "", type: "physical", price: "", description: "", deliveryNotes: "" });
        setImages([]);
        setCropQueue([]);
        setCropSrc(null);
        setOpen(false);
        await onSaved();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Não foi possível salvar o produto.");
      }
    } catch {
      setError("Não foi possível salvar o produto.");
    } finally {
      setBusy(false);
    }
  }

  let submitLabel = "Salvar produto";
  if (editingProduct) submitLabel = "Salvar alterações";
  if (busy) submitLabel = "Salvando...";

  const imageButtonLabel = images.length > 0 ? "Adicionar imagem" : "Enviar imagens";

  return (
    <section className={styles.section}>
      <div className={styles.formHeader}>
        <Heading as="h2" className={styles.sectionTitle}>
          {editingProduct ? "Editar produto" : "Cadastrar produto"}
        </Heading>
        {editingProduct ? (
          <Button onClick={handleCancelEdit} disabled={busy}>
            Cancelar
          </Button>
        ) : (
          <Button onClick={() => setOpen((v) => !v)} disabled={disabled}>
            {open ? "Fechar" : "Novo produto"}
          </Button>
        )}
      </div>

      {open && (
        <form onSubmit={submit} className={styles.form}>
          {error ? (
            <Banner variant="critical" title="Não foi possível salvar o produto">
              {error}
            </Banner>
          ) : null}
          <FormControl required>
            <FormControl.Label>Nome do produto</FormControl.Label>
            <TextInput value={form.name} onChange={(e) => update("name", e.target.value)} disabled={busy} />
          </FormControl>
          <div className={styles.formRow}>
            <FormControl required>
              <FormControl.Label>Tipo</FormControl.Label>
              <Select value={form.type} onChange={(e) => update("type", e.target.value)} disabled={busy}>
                {PRODUCT_TYPES.map((t) => (
                  <Select.Option key={t} value={t}>
                    {PRODUCT_TYPE_LABELS[t]}
                  </Select.Option>
                ))}
              </Select>
            </FormControl>
            <FormControl required>
              <FormControl.Label>Preço (R$)</FormControl.Label>
              <TextInput type="number" min="0" step="0.01" value={form.price} onChange={(e) => update("price", e.target.value)} disabled={busy} />
            </FormControl>
          </div>
          <FormControl>
            <FormControl.Label>Descrição</FormControl.Label>
            <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} disabled={busy} />
          </FormControl>
          <FormControl>
            <FormControl.Label>Prazo e entrega</FormControl.Label>
            <Textarea
              value={form.deliveryNotes}
              onChange={(e) => update("deliveryNotes", e.target.value)}
              placeholder="Ex: envio em até 7 dias úteis via Correios..."
              disabled={busy}
            />
          </FormControl>
          <FormControl>
            <FormControl.Label>Imagens do produto</FormControl.Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className={styles.hiddenInput}
              onChange={handleImageFileChange}
              aria-label="Enviar imagens do produto"
            />
            <div className={styles.imageField}>
              <div className={styles.thumbGrid}>
                {images.length === 0 ? (
                  <div className={styles.imagePreview}>
                    <div className={styles.imagePlaceholder}>🎁</div>
                  </div>
                ) : (
                  images.map((img, index) => (
                    <div key={img.id || img.preview} className={styles.imageThumb}>
                      <div className={styles.imagePreview}>
                        <Image src={img.preview} alt={`Imagem ${index + 1}`} fill sizes="160px" unoptimized />
                        {index === 0 && <span className={styles.coverBadge}>Capa</span>}
                      </div>
                      <div className={styles.thumbActions}>
                        <button type="button" onClick={() => moveImage(index, -1)} disabled={busy || index === 0} aria-label="Mover para a esquerda">
                          ←
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(index, 1)}
                          disabled={busy || index === images.length - 1}
                          aria-label="Mover para a direita"
                        >
                          →
                        </button>
                        <button type="button" onClick={() => removeImageAt(index)} disabled={busy} aria-label="Remover imagem">
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className={styles.imageActions}>
                <Button type="button" size="small" onClick={openImagePicker} disabled={busy}>
                  {imageButtonLabel}
                </Button>
              </div>
            </div>
          </FormControl>
          <Button type="submit" variant="primary" disabled={busy}>
            {submitLabel}
          </Button>
        </form>
      )}

      {cropSrc && <ImageCropModal imageSrc={cropSrc} preset="product" onConfirm={handleImageCropConfirm} onClose={handleCropClose} />}
    </section>
  );
}

function OrderRow({ order }) {
  const [status, setStatus] = useState(order.status);
  const [deliveryCost, setDeliveryCost] = useState(order.delivery_cost != null ? String(order.delivery_cost) : "");
  const [deadline, setDeadline] = useState(order.delivery_deadline_days != null ? String(order.delivery_deadline_days) : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const payload = { status };
      if (status === "quoted") {
        payload.deliveryCost = Number(deliveryCost);
        payload.deliveryDeadlineDays = Number(deadline);
      }
      if (note.trim()) payload.note = note.trim();

      const res = await fetch(`/api/v1/store/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSaved(true);
        setNote("");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Não foi possível atualizar o pedido.");
      }
    } catch {
      setError("Não foi possível atualizar o pedido.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.orderCard}>
      <div className={styles.orderInfo}>
        <span className={styles.orderProduct}>{order.product_name || "Produto removido"}</span>
        <span className={styles.orderMeta}>
          {order.quantity} un. · {formatBRL(order.total)}
        </span>
        <span className={styles.orderMeta}>Comprador: {order.buyer_username || "—"}</span>
        {order.buyer_note ? <span className={styles.orderNote}>Nota: {order.buyer_note}</span> : null}
      </div>

      <div className={styles.orderEdit}>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} disabled={busy}>
          {ORDER_STATUSES.map((s) => (
            <Select.Option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </Select.Option>
          ))}
        </Select>

        {status === "quoted" && (
          <div className={styles.quoteFields}>
            <TextInput
              type="number"
              min="0"
              step="0.01"
              placeholder="Frete (R$)"
              value={deliveryCost}
              onChange={(e) => setDeliveryCost(e.target.value)}
              disabled={busy}
              aria-label="Custo de entrega"
            />
            <TextInput
              type="number"
              min="1"
              placeholder="Prazo (dias)"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={busy}
              aria-label="Prazo de entrega em dias"
            />
            <TextInput
              placeholder="Observação (opcional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={busy}
              aria-label="Observação do pedido"
            />
          </div>
        )}

        {error ? <span className={styles.error}>{error}</span> : null}
        {saved ? <span className={styles.saved}>Atualizado!</span> : null}

        <Button size="small" variant="primary" onClick={save} disabled={busy}>
          {busy ? "Salvando..." : "Salvar status"}
        </Button>
      </div>
    </div>
  );
}
