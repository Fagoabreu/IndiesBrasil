import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import styles from "./curriculo.module.css";
import DateUtils from "@/utils/DateUtils";
import { SITE_URL } from "@/lib/seo";
import { DEFAULT_QR_SETTINGS } from "@/components/QrCode/QrCodeCustomizer";

const EXPERIENCE_LABELS = {
  estudante: "Estudante",
  junior: "Junior",
  pleno: "Pleno",
  senior: "Sênior",
  especialista: "Especialista",
};

export default function CurriculoPage() {
  const router = useRouter();
  const { username } = router.query;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const qrSettings = useMemo(() => {
    if (!username || globalThis.window === undefined)
      return { ...DEFAULT_QR_SETTINGS };
    try {
      const raw = localStorage.getItem(`qr_settings_${username}`);
      if (raw) return { ...DEFAULT_QR_SETTINGS, ...JSON.parse(raw) };
    } catch {
      // localStorage indisponível
    }
    return { ...DEFAULT_QR_SETTINGS };
  }, [username]);

  useEffect(() => {
    if (!username) return;

    fetch(`/api/v1/users/${username}/profile`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [username]);

  if (loading) {
    return <div className={styles.loading}>Carregando currículo...</div>;
  }

  if (!profile || profile.status_code) {
    return <div className={styles.loading}>Perfil não encontrado.</div>;
  }

  const {
    user,
    historico = [],
    formacoes = [],
    contacts = [],
    roles = [],
    tools = [],
  } = profile;

  const fullName = profile.name || user.username;
  const profileUrl = `${SITE_URL}/perfil/${username}`;
  const sortedHistorico = [...historico].sort((a, b) => a.ordem - b.ordem);
  const sortedFormacoes = [...formacoes].sort((a, b) => a.ordem - b.ordem);

  function handlePrint() {
    const prevTitle = document.title;
    document.title = `Currículo - ${fullName}`;
    globalThis.print();
    document.title = prevTitle;
  }

  return (
    <>
      <Head>
        <title>Currículo — {fullName}</title>
        <meta name="robots" content="noindex" />
      </Head>

      {/* Barra de ação — oculta no print */}
      <div className={styles.printBar}>
        <p className={styles.printHint}>
          Currículo de <strong>{fullName}</strong> ·{" "}
          <a href={profileUrl} target="_blank" rel="noopener noreferrer">
            ver perfil completo
          </a>
        </p>
        <button type="button" className={styles.printBtn} onClick={handlePrint}>
          ⬇ Imprimir / Salvar PDF
        </button>
      </div>

      {/* Documento do currículo */}
      <div className={styles.page}>
        {/* ===== CABEÇALHO ===== */}
        <header className={styles.cvHeader}>
          {/* Avatar */}
          <Image
            src={user.avatar_image || "/images/avatar.png"}
            alt={fullName}
            width={82}
            height={82}
            className={styles.cvAvatar}
          />

          {/* Nome / Especializações / Bio */}
          <div className={styles.cvHeaderMain}>
            <h1 className={styles.cvName}>{fullName}</h1>

            {roles.length > 0 && (
              <p className={styles.cvRoles}>
                {roles.map((r) => r.portfolio_role_name).join(" · ")}
              </p>
            )}

            {(user.resumo || user.bio) && (
              <p className={styles.cvBio}>{user.resumo || user.bio}</p>
            )}
          </div>

          {/* Coluna direita: contatos + QR */}
          <div className={styles.cvHeaderRight}>
            {contacts.length > 0 && (
              <ul className={styles.cvHeaderContacts}>
                {contacts.map((c) => (
                  <li key={c.id}>
                    {(c.nome || c.icon_key) && (
                      <span className={styles.cvContactLabel}>
                        {c.nome || c.icon_key}
                      </span>
                    )}
                    <span>{c.contact_value}</span>
                  </li>
                ))}
                <li>
                  <span className={styles.cvContactLabel}>Perfil</span>
                  <span>{profileUrl}</span>
                </li>
              </ul>
            )}

            <div className={styles.cvQr}>
              <QRCodeSVG
                value={profileUrl}
                size={80}
                fgColor={qrSettings.fgColor}
                bgColor={qrSettings.bgColor}
                imageSettings={
                  qrSettings.logoURL
                    ? {
                        src: qrSettings.logoURL,
                        width: qrSettings.logoSize || 20,
                        height: qrSettings.logoSize || 20,
                        excavate: true,
                      }
                    : undefined
                }
              />
              <span className={styles.cvQrLabel}>indiesbrasil.com.br</span>
            </div>
          </div>
        </header>

        {/* ===== CORPO ===== */}
        <div className={styles.cvBody}>
          {/* Coluna principal */}
          <main className={styles.cvMain}>
            {/* Bio complementar (só mostra se ambos existem) */}
            {user.resumo && user.bio && (
              <section className={styles.cvSection}>
                <h2 className={styles.cvSectionTitle}>Sobre</h2>
                <p>{user.bio}</p>
              </section>
            )}

            {/* Histórico Profissional */}
            {sortedHistorico.length > 0 && (
              <section className={styles.cvSection}>
                <h2 className={styles.cvSectionTitle}>
                  Histórico Profissional
                </h2>
                {sortedHistorico.map((h) => (
                  <div key={h.id} className={styles.cvEntry}>
                    <div className={styles.cvEntryHeader}>
                      <span className={styles.cvEntryTitle}>{h.cargo}</span>
                      <span className={styles.cvDate}>
                        {DateUtils.formatMonthYear(h.init_date)} —{" "}
                        {h.end_date
                          ? DateUtils.formatMonthYear(h.end_date)
                          : "Atual"}
                      </span>
                    </div>
                    <div className={styles.cvEntrySub}>
                      {h.company}
                      {h.cidade ? ` · ${h.cidade}` : ""}
                      {h.estado ? `, ${h.estado}` : ""}
                    </div>
                    {Array.isArray(h.atribuicoes) &&
                      h.atribuicoes.length > 0 && (
                        <ul className={styles.cvEntryList}>
                          {h.atribuicoes.map((a) => (
                            <li key={a}>{a}</li>
                          ))}
                        </ul>
                      )}
                  </div>
                ))}
              </section>
            )}

            {/* Formação Acadêmica */}
            {sortedFormacoes.length > 0 && (
              <section className={styles.cvSection}>
                <h2 className={styles.cvSectionTitle}>Formação Acadêmica</h2>
                {sortedFormacoes.map((f) => (
                  <div key={f.id} className={styles.cvEntry}>
                    <div className={styles.cvEntryHeader}>
                      <span className={styles.cvEntryTitle}>{f.nome}</span>
                      <span className={styles.cvDate}>
                        {DateUtils.formatMonthYear(f.init_date)} —{" "}
                        {f.end_date
                          ? DateUtils.formatMonthYear(f.end_date)
                          : "Atual"}
                      </span>
                    </div>
                    <div className={styles.cvEntrySub}>{f.instituicao}</div>
                  </div>
                ))}
              </section>
            )}
          </main>

          {/* Coluna lateral */}
          <aside className={styles.cvSidebar}>
            {/* Contatos */}
            {contacts.length > 0 && (
              <section className={styles.cvSection}>
                <h2 className={styles.cvSectionTitle}>Contato</h2>
                <ul className={styles.cvSideList}>
                  {contacts.map((c) => (
                    <li key={c.id} className={styles.cvSideItem}>
                      <span className={styles.cvSideItemName}>
                        {c.nome || c.icon_key}
                      </span>
                      <span className={styles.cvSideItemLevel}>
                        {c.contact_value}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Especializações */}
            {roles.length > 0 && (
              <section className={styles.cvSection}>
                <h2 className={styles.cvSectionTitle}>Especializações</h2>
                <ul className={styles.cvSideList}>
                  {roles.map((r) => (
                    <li
                      key={r.portfolio_role_name}
                      className={styles.cvSideItem}
                    >
                      <span className={styles.cvSideItemName}>
                        {r.portfolio_role_name}
                      </span>
                      {r.experience && (
                        <span className={styles.cvSideItemLevel}>
                          {EXPERIENCE_LABELS[r.experience?.toLowerCase()] ||
                            r.experience}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Ferramentas */}
            {tools.length > 0 && (
              <section className={styles.cvSection}>
                <h2 className={styles.cvSectionTitle}>Ferramentas</h2>
                <ul className={styles.cvSideList}>
                  {tools.map((t) => (
                    <li
                      key={t.portfolio_tool_id || t.name}
                      className={styles.cvSideItem}
                    >
                      <span className={styles.cvSideItemName}>{t.name}</span>
                      {t.experience && (
                        <span className={styles.cvSideItemLevel}>
                          {EXPERIENCE_LABELS[t.experience?.toLowerCase()] ||
                            t.experience}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>

        <footer className={styles.cvFooter}>
          Gerado em {new Date().toLocaleDateString("pt-BR")} · {profileUrl}
        </footer>
      </div>
    </>
  );
}

// Opt-out do Layout global (header + sidebar não aparecem no currículo)
CurriculoPage.noLayout = true;
