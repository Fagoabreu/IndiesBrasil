"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PropTypes from "prop-types";
import { Button, Spinner } from "@primer/react";

import StatusMessageComponent from "@/components/StatusMessage/StatusMessageComponent";
import { MAX_PRICE_NOTE_LENGTH, MAX_SERVICE_SUMMARY_LENGTH, MAX_STUDIO_SERVICES, groupServices } from "@/lib/serviceGroups";
import styles from "./StudioServicesEditor.module.css";

/**
 * Aba "Serviços" das configurações do estúdio.
 *
 * A lista de serviços do catálogo é pública (`/api/v1/services`); o que se edita
 * aqui é a **declaração** do estúdio: quais ele presta, com que resumo e a que
 * valor de referência.
 *
 * ## Por que um mapa de serviço → detalhe
 *
 * Cada serviço marcado pode ter resumo e preço próprios, e o formulário é uma
 * grade de checkboxes. Guardar `{ [serviceId]: { summary, price, price_note } }`
 * mantém os valores digitados quando a pessoa desmarca e remarca — perder o que
 * ela escreveu porque desmarcou por engano é o tipo de coisa que faz alguém
 * desistir do formulário.
 *
 * ## Serviço desativado continua visível
 *
 * Ele aparece marcado e **não selecionável** (mesma solução do seletor de
 * categorias de asset): sem isso, salvar o formulário apagaria a declaração que
 * o estúdio fez antes de o admin aposentar o serviço, e ele não teria como
 * recuperá-la — o serviço não está mais na lista pública.
 */
export default function StudioServicesEditor({ slug }) {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState({ type: null, text: "" });
  const [saving, setSaving] = useState(false);

  // Detalhe por serviço, preservado ao desmarcar (ver o cabeçalho).
  const [details, setDetails] = useState({});

  const reload = useCallback(async () => {
    const [catalogRes, mineRes] = await Promise.all([
      fetch("/api/v1/services", { credentials: "include" }),
      fetch(`/api/v1/studios/${encodeURIComponent(slug)}/services`, { credentials: "include" }),
    ]);

    if (!catalogRes.ok) throw new Error("Não foi possível carregar o catálogo de serviços.");

    const catalogData = await catalogRes.json();
    const mineData = mineRes.ok ? await mineRes.json() : [];

    const mineBySlug = new Map((Array.isArray(mineData) ? mineData : []).map((item) => [item.slug, item]));

    // Um serviço desativado que o estúdio já declarava não volta na lista
    // pública: é acrescentado ao catálogo local para não sumir da tela.
    const missing = (Array.isArray(mineData) ? mineData : []).filter((item) => !catalogData.some((service) => service.slug === item.slug));

    setCatalog([...(Array.isArray(catalogData) ? catalogData : []), ...missing]);

    const nextDetails = {};
    for (const item of mineBySlug.values()) {
      nextDetails[item.id] = {
        selected: true,
        summary: item.summary || "",
        price: item.price == null ? "" : String(item.price),
        price_note: item.price_note || "",
      };
    }
    setDetails(nextDetails);
  }, [slug]);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await reload();
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, reload]);

  const groups = useMemo(() => groupServices(catalog), [catalog]);

  const selectedCount = Object.values(details).filter((item) => item.selected).length;

  function updateDetail(serviceId, patch) {
    setDetails((current) => ({
      ...current,
      [serviceId]: { selected: false, summary: "", price: "", price_note: "", ...current[serviceId], ...patch },
    }));
  }

  function toggle(service) {
    const current = details[service.id] || { selected: false, summary: "", price: "", price_note: "" };
    const willSelect = !current.selected;

    if (willSelect && selectedCount >= MAX_STUDIO_SERVICES) {
      setMessage({ type: "error", text: `Você pode declarar no máximo ${MAX_STUDIO_SERVICES} serviços.` });
      return;
    }

    setMessage({ type: null, text: "" });
    updateDetail(service.id, { selected: willSelect });
  }

  async function handleSave() {
    setSaving(true);
    setMessage({ type: null, text: "" });

    try {
      const payload = catalog
        .filter((service) => details[service.id]?.selected)
        .map((service) => ({
          service_id: service.id,
          summary: details[service.id].summary || null,
          price: details[service.id].price === "" ? null : details[service.id].price,
          price_note: details[service.id].price_note || null,
        }));

      const response = await fetch(`/api/v1/studios/${encodeURIComponent(slug)}/services`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ services: payload }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: "error", text: data.message || "Erro ao salvar os serviços." });
        return;
      }

      setMessage({ type: "success", text: "Serviços atualizados." });
      await reload();
    } catch {
      setMessage({ type: "error", text: "Erro de conexão. Tente novamente." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner size="small" />
      </div>
    );
  }

  if (error) {
    return <StatusMessageComponent type="danger" message={error} />;
  }

  return (
    <section className={styles.wrapper}>
      <h2 className={styles.title}>Serviços</h2>
      <p className={styles.intro}>
        Marque o que o estúdio presta para outros times. A lista pública fica em <Link href="/servicos">/servicos</Link>, onde quem procura um serviço
        encontra o seu estúdio e pode mandar mensagem.
      </p>

      {groups.map((group) => (
        <div key={group.key} className={styles.group}>
          <p className={styles.groupTitle}>{group.label}</p>

          <ul className={styles.serviceList}>
            {group.services.map((service) => {
              const detail = details[service.id] || { selected: false, summary: "", price: "", price_note: "" };
              // Desativado e não declarado: não há por que oferecer. Desativado e
              // já declarado: aparece marcado e travado (ver o cabeçalho).
              const blocked = !service.is_active && !detail.selected;

              return (
                <li key={service.id} className={`${styles.serviceItem} ${detail.selected ? styles.serviceSelected : ""}`}>
                  <label className={styles.serviceLabel} title={blocked ? "Serviço desativado pela administração." : undefined}>
                    <input type="checkbox" checked={detail.selected} disabled={blocked} onChange={() => toggle(service)} />
                    <span className={styles.serviceName}>{service.name}</span>
                    {!service.is_active && <span className={styles.inactiveTag}>desativado</span>}
                  </label>

                  {detail.selected && (
                    <div className={styles.serviceFields}>
                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>Como o estúdio faz</span>
                        <input
                          type="text"
                          className={styles.input}
                          value={detail.summary}
                          onChange={(event) => updateDetail(service.id, { summary: event.target.value })}
                          maxLength={MAX_SERVICE_SUMMARY_LENGTH}
                          placeholder="Ex: portamos para Switch e mobile com o time original"
                        />
                      </label>

                      <label className={`${styles.field} ${styles.priceField}`}>
                        <span className={styles.fieldLabel}>Valor de referência (opcional)</span>
                        <div className={styles.priceRow}>
                          <span className={styles.currency}>R$</span>
                          <input
                            type="number"
                            className={styles.input}
                            value={detail.price}
                            onChange={(event) => updateDetail(service.id, { price: event.target.value })}
                            min="0"
                            step="0.01"
                            placeholder="1500"
                          />
                          <input
                            type="text"
                            className={styles.input}
                            value={detail.price_note}
                            onChange={(event) => updateDetail(service.id, { price_note: event.target.value })}
                            maxLength={MAX_PRICE_NOTE_LENGTH}
                            placeholder="por projeto"
                          />
                        </div>
                        <span className={styles.hint}>Informativo — o negócio é fechado por mensagem. Deixe vazio se preferir “a combinar”.</span>
                      </label>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className={styles.footer}>
        <span className={styles.counter}>
          {selectedCount} de {MAX_STUDIO_SERVICES} serviços
        </span>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? "Salvando…" : "Salvar serviços"}
        </Button>
      </div>

      {message.text && <StatusMessageComponent type={message.type} message={message.text} />}

      <p className={styles.suggestionHint}>
        Faltou um serviço? <Link href="/servicos/sugerir">Sugira para a administração</Link> — qualquer pessoa com conta pode sugerir.
      </p>
    </section>
  );
}

StudioServicesEditor.propTypes = {
  /** Slug do estúdio — o destino é sempre o painel dele. */
  slug: PropTypes.string.isRequired,
};
