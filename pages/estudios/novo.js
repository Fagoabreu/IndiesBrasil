"use client";
import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Spinner } from "@primer/react";
import { ArrowLeftIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import AddressFormFields from "@/components/Address/AddressFormFields";
import styles from "./novo.module.css";

const EMPTY_ADDRESS = {
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  zip_code: "",
  country: "Brasil",
};

export default function NovoEstudioPage() {
  const router = useRouter();
  const { user, loadingUser } = useUser();

  const [name, setName] = useState("");
  const [pitch, setPitch] = useState("");
  const [description, setDescription] = useState("");
  const [history, setHistory] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [foundedAt, setFoundedAt] = useState("");
  const [showAddress, setShowAddress] = useState(false);
  const [address, setAddress] = useState(EMPTY_ADDRESS);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleAddressChange(field, value) {
    setAddress((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("O nome do estúdio é obrigatório.");
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        name: name.trim(),
        pitch: pitch.trim() || undefined,
        description: description.trim() || undefined,
        history: history.trim() || undefined,
        cnpj: cnpj.trim() || undefined,
        founded_at: foundedAt || undefined,
        address: showAddress && address.city ? address : undefined,
      };

      const res = await fetch("/api/v1/studios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Erro ao criar o estúdio.");
        return;
      }

      router.push(`/estudios/${data.slug}`);
    } catch {
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingUser) {
    return (
      <div className={styles.loading}>
        <Spinner size="large" />
      </div>
    );
  }

  if (!user?.features?.includes("create:studio")) {
    return (
      <div className={styles.forbidden}>
        <p>Você não tem permissão para criar um estúdio.</p>
        <Link href="/estudios" className={styles.backLink}>
          <ArrowLeftIcon size={14} /> Voltar para estúdios
        </Link>
      </div>
    );
  }

  return (
    <>
      <SeoHead title="Criar Estúdio — Indies Brasil" robots="noindex" />

      <div className={styles.pageWrapper}>
        <Link href="/estudios" className={styles.backLink}>
          <ArrowLeftIcon size={14} /> Voltar para estúdios
        </Link>

        <h1 className={styles.pageTitle}>Criar estúdio</h1>

        {error && <p className={styles.errorMsg}>{error}</p>}

        <form className={styles.form} onSubmit={handleSubmit}>
          {/* NOME */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="studio_name">
              Nome <span className={styles.required}>*</span>
            </label>
            <input
              id="studio_name"
              type="text"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Nome do seu estúdio"
              required
            />
          </div>

          {/* PITCH */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="studio_pitch">
              Tagline
            </label>
            <input
              id="studio_pitch"
              type="text"
              className={styles.input}
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              maxLength={200}
              placeholder="Uma frase curta que descreve o estúdio"
            />
            <span className={styles.hint}>Máx. 200 caracteres. Aparece nos cards de listagem.</span>
          </div>

          {/* DESCRIÇÃO */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="studio_description">
              Sobre o estúdio
            </label>
            <textarea
              id="studio_description"
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Uma breve descrição do estúdio, missão e projetos..."
            />
          </div>

          {/* HISTÓRIA */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="studio_history">
              História
            </label>
            <textarea
              id="studio_history"
              className={styles.textarea}
              value={history}
              onChange={(e) => setHistory(e.target.value)}
              rows={6}
              placeholder="Como o estúdio surgiu, sua trajetória, conquistas..."
            />
          </div>

          <hr className={styles.divider} />
          <p className={styles.sectionTitle}>Informações opcionais</p>

          {/* LINHA: CNPJ + FUNDAÇÃO */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="studio_cnpj">
                CNPJ
              </label>
              <input
                id="studio_cnpj"
                type="text"
                className={styles.input}
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="studio_founded">
                Data de fundação
              </label>
              <input id="studio_founded" type="date" className={styles.input} value={foundedAt} onChange={(e) => setFoundedAt(e.target.value)} />
            </div>
          </div>

          {/* ENDEREÇO */}
          <label className={styles.checkboxField}>
            <input type="checkbox" checked={showAddress} onChange={(e) => setShowAddress(e.target.checked)} />
            <span className={styles.checkboxLabel}>Adicionar endereço</span>
          </label>

          {showAddress && (
            <div className={styles.addressBox}>
              <AddressFormFields value={address} onChange={handleAddressChange} />
            </div>
          )}

          <hr className={styles.divider} />

          {/* AÇÕES */}
          <div className={styles.actions}>
            <Link href="/estudios" className={styles.cancelBtn}>
              Cancelar
            </Link>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? <Spinner size="small" /> : "Criar estúdio"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
