import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import Head from "next/head";
import { QRCodeSVG } from "qrcode.react";
import styles from "./press-kit.module.css";
import { SITE_URL } from "@/lib/seo";

function formatDateBR(dateStr) {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(dateStr));
}

function formatCNPJ(raw) {
  if (!raw) return "";
  const d = raw.replace(/\D/g, "");
  if (d.length !== 14) return raw;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function buildAddressLines(addr) {
  if (!addr) return [];
  const line1 = [addr.street, addr.number, addr.complement].filter(Boolean).join(", ");
  const line2 = [addr.neighborhood, addr.city, addr.state].filter(Boolean).join(", ");
  const line3 = [addr.zip_code, addr.country].filter(Boolean).join(" — ");
  return [line1, line2, line3].filter(Boolean);
}

export default function PressKitPage() {
  const router = useRouter();
  const { slug } = router.query;

  const [studio, setStudio] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/v1/studios/${slug}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setStudio(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return <div className={styles.loading}>Carregando press kit...</div>;
  }

  if (!studio || studio.status_code) {
    return <div className={styles.loading}>Estúdio não encontrado.</div>;
  }

  const studioUrl = `${SITE_URL}/estudios/${slug}`;
  const members = studio.members ?? [];
  const addressLines = buildAddressLines(studio.address);
  const contacts = studio.contacts ?? [];

  function handlePrint() {
    const prev = document.title;
    document.title = `Press Kit — ${studio.name}`;
    globalThis.print();
    document.title = prev;
  }

  return (
    <>
      <Head>
        <title>Press Kit — {studio.name}</title>
        <meta name="robots" content="noindex" />
      </Head>

      {/* Barra de ação — oculta no print */}
      <div className={styles.printBar}>
        <p className={styles.printHint}>
          Press Kit de <strong>{studio.name}</strong> ·{" "}
          <a href={studioUrl} target="_blank" rel="noopener noreferrer">
            ver página
          </a>
        </p>
        <button type="button" className={styles.printBtn} onClick={handlePrint}>
          ⬇ Imprimir / Salvar PDF
        </button>
      </div>

      {/* Documento do press kit */}
      <div className={styles.page}>
        {/* CABEÇALHO HERO */}
        <header className={styles.pkHeader}>
          {studio.logo_url && (
            <Image
              src={studio.logo_url}
              alt={`Logo de ${studio.name}`}
              width={96}
              height={96}
              className={styles.pkLogo}
              style={{ objectFit: "contain" }}
            />
          )}
          <div className={styles.pkHeaderText}>
            <h1 className={styles.pkName}>{studio.name}</h1>
            {studio.pitch && <p className={styles.pkPitch}>{studio.pitch}</p>}
          </div>
        </header>

        {/* CORPO: conteúdo principal + factsheet */}
        <div className={styles.body}>
          {/* COLUNA PRINCIPAL */}
          <main className={styles.mainCol}>
            {studio.description && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Sobre</h2>
                <p className={styles.bodyText}>{studio.description}</p>
              </section>
            )}

            {studio.history && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>História</h2>
                <p className={styles.bodyText}>{studio.history}</p>
              </section>
            )}

            {members.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Equipe</h2>
                <ul className={styles.memberList}>
                  {members.map((m) => (
                    <li key={m.user_id ?? m.id} className={styles.memberItem}>
                      <span className={styles.memberName}>{m.display_name || m.username}</span>
                      {m.roles?.length > 0 && <span className={styles.memberRole}>{m.roles.join(", ")}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Placeholder jogos */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Jogos</h2>
              <p className={styles.emptyHint}>Os jogos do estúdio serão listados aqui em breve.</p>
            </section>
          </main>

          {/* FACTSHEET LATERAL */}
          <aside className={styles.factsheet}>
            <h2 className={styles.factsheetTitle}>Factsheet</h2>

            <dl className={styles.factList}>
              <div className={styles.factRow}>
                <dt>Empresa</dt>
                <dd>{studio.name}</dd>
              </div>

              {studio.founded_at && (
                <div className={styles.factRow}>
                  <dt>Fundada em</dt>
                  <dd>{formatDateBR(studio.founded_at)}</dd>
                </div>
              )}

              {studio.cnpj && (
                <div className={styles.factRow}>
                  <dt>CNPJ</dt>
                  <dd>{formatCNPJ(studio.cnpj)}</dd>
                </div>
              )}

              {addressLines.length > 0 && (
                <div className={styles.factRow}>
                  <dt>Localização</dt>
                  <dd>
                    {addressLines.map((line) => (
                      <span key={line} className={styles.addrLine}>
                        {line}
                      </span>
                    ))}
                  </dd>
                </div>
              )}

              {contacts.length > 0 && (
                <div className={styles.factRow}>
                  <dt>Contatos</dt>
                  <dd>
                    {contacts.map((c) => (
                      <span key={c.id ?? c.contact_value} className={styles.addrLine}>
                        {c.nome && <strong>{c.nome}: </strong>}
                        {c.contact_value}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>

            {/* QR Code */}
            <div className={styles.qrBlock}>
              <QRCodeSVG value={studioUrl} size={96} bgColor="#ffffff" fgColor="#1a1a2e" />
              <span className={styles.qrLabel}>{studioUrl}</span>
            </div>
          </aside>
        </div>

        {/* RODAPÉ */}
        <footer className={styles.pkFooter}>
          <span>Gerado em {new Intl.DateTimeFormat("pt-BR").format(new Date())}</span>
          <span>{studioUrl}</span>
        </footer>
      </div>
    </>
  );
}
