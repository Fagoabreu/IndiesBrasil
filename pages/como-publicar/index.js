import Link from "next/link";
import PropTypes from "prop-types";
import { ArrowRightIcon, CheckCircleFillIcon, PlusIcon } from "@primer/octicons-react";

import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import { SITE_URL } from "@/lib/seo";
import { breadcrumbList } from "@/lib/structured-data";
import { HOW_TO_PUBLISH_PATH, STUDIO_ENTRY_KINDS, resolveStudioEntry } from "@/lib/studioEntry";
import styles from "./index.module.css";

const PAGE_TITLE = "Como publicar no Indies Brasil";
const PAGE_DESCRIPTION =
  "Todo jogo, jogo de mesa, publicação, asset e canal de transmissão do Indies Brasil é publicado por um estúdio. Veja como criar o seu em três passos.";
const PAGE_URL = `${SITE_URL}${HOW_TO_PUBLISH_PATH}`;

/**
 * O que dá para publicar e onde.
 *
 * `tab` é a aba de `/configuracoes` do estúdio onde o formulário vive. É a
 * mesma chave de `STUDIO_PRODUCT_TABS` (`lib/studioEntry.js`) — a página e os
 * botões de publicação têm de apontar para o mesmo lugar.
 */
const PUBLISH_TYPES = [
  { label: "Jogo digital", detail: "Nome, descrição, mídia, plataformas, lojas", tab: "games", tabLabel: "Jogos" },
  { label: "Jogo de mesa", detail: "Tabuleiro, cartas, RPG, dados, miniaturas", tab: "boardgames", tabLabel: "Jogos de Mesa" },
  { label: "Livro e quadrinho", detail: "Livro, quadrinho, mangá, zine, artbook", tab: "books", tabLabel: "Publicações" },
  { label: "Asset", detail: "Arte, áudio, UI, VFX e código — com link externo", tab: "assets", tabLabel: "Assets" },
  { label: "Canal de transmissão", detail: "Twitch e YouTube, com status ao vivo", tab: "streaming", tabLabel: "Streaming" },
];

const STEPS = [
  {
    title: "Crie o estúdio",
    body: "Nome, descrição e logo. CNPJ e endereço são opcionais — só são pedidos para vender na loja.",
  },
  {
    title: "Convide a equipe",
    body: "Quem aceita o convite vira membro e publica junto. Você pode fazer parte de vários estúdios.",
  },
  {
    title: "Publique",
    body: "Cada tipo de conteúdo tem a sua aba no painel do estúdio. É de lá que saem os cards do site.",
  },
];

const FAQ = [
  {
    q: "Por que preciso de um estúdio?",
    a: "A obra é assinada pelo estúdio, não pelo perfil pessoal. Assim o crédito, a equipe, os contatos de imprensa e as obras ficam no mesmo lugar — e o mesmo estúdio pode ter quantas obras quiser.",
  },
  {
    q: "Posso publicar sozinho, sem equipe?",
    a: "Sim. Um estúdio pode ter uma pessoa só: você cria, você publica. Convidar membros é opcional e pode acontecer depois.",
  },
  {
    q: "Preciso de CNPJ?",
    a: "Não. CNPJ, endereço e contato comercial só entram na configuração da loja, quando você for vender produto físico ou digital por aqui.",
  },
  {
    q: "Posso fazer parte do estúdio de outra pessoa?",
    a: "Sim, por convite. Quem é responsável ou administrador do estúdio pode convidar pelo @usuario na aba Equipe.",
  },
  {
    q: "Já tenho um estúdio. Como publico um jogo novo?",
    a: "Abra o estúdio, clique em Gerenciar e escolha a aba do tipo de conteúdo. O botão Adicionar fica no topo dessa aba.",
  },
  {
    q: "Quanto custa?",
    a: "Publicar é gratuito. A loja do estúdio é um recurso separado, para quem quiser vender.",
  },
];

/** CTA que muda com o estado da sessão (ver `resolveStudioEntry`). */
function StudioCta({ user, loadingUser, myStudios, tab = "", primary = false }) {
  const entry = resolveStudioEntry({ user, loadingUser, studios: myStudios, tab });
  const isCreate = entry.kind === STUDIO_ENTRY_KINDS.CREATE;

  return (
    <Link href={entry.href} className={primary ? styles.ctaPrimary : styles.ctaSecondary}>
      {isCreate ? <PlusIcon size={16} /> : <ArrowRightIcon size={16} />}
      {entry.label}
    </Link>
  );
}

StudioCta.propTypes = {
  user: PropTypes.object,
  loadingUser: PropTypes.bool,
  myStudios: PropTypes.array,
  tab: PropTypes.string,
  primary: PropTypes.bool,
};

export default function ComoPublicarPage() {
  const { user, loadingUser, myStudios } = useUser();

  return (
    <>
      <SeoHead
        title={`${PAGE_TITLE} — Indies Brasil`}
        description={PAGE_DESCRIPTION}
        canonical={PAGE_URL}
        jsonLd={breadcrumbList([{ name: "Como publicar", path: HOW_TO_PUBLISH_PATH }])}
      />

      <div className={styles.page}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Para quem quer publicar</p>
          <h1 className={styles.title}>Como publicar no Indies Brasil</h1>
          <p className={styles.lead}>
            Todo jogo, jogo de mesa, publicação, asset e canal de transmissão é publicado por um <strong>estúdio</strong>. Não existe publicação em
            perfil pessoal: o estúdio é quem assina a obra.
          </p>

          <div className={styles.heroActions}>
            <StudioCta user={user} loadingUser={loadingUser} myStudios={myStudios} primary />
            <Link href="/estudios" className={styles.ctaGhost}>
              Ver estúdios existentes
            </Link>
          </div>
        </header>

        <section className={styles.steps} aria-labelledby="passos">
          <h2 id="passos" className={styles.sectionTitle}>
            Três passos
          </h2>

          <ol className={styles.stepList}>
            {STEPS.map((step, index) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <div className={styles.stepBody}>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepText}>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.typesSection} aria-labelledby="tipos">
          <h2 id="tipos" className={styles.sectionTitle}>
            O que dá para publicar
          </h2>
          <p className={styles.sectionLead}>
            Tudo fica no painel do estúdio (<span className={styles.mono}>Gerenciar → aba do tipo</span>). Cada aba tem a lista das obras já
            publicadas e o botão para adicionar uma nova.
          </p>

          <div className={styles.typeTable} role="table" aria-label="Tipos de conteúdo e onde publicar">
            <div className={`${styles.typeRow} ${styles.typeHeader}`} role="row">
              <span role="columnheader">Conteúdo</span>
              <span role="columnheader">O que entra</span>
              <span role="columnheader">Onde no estúdio</span>
            </div>

            {PUBLISH_TYPES.map((type) => (
              <div key={type.label} className={styles.typeRow} role="row">
                <span role="cell" className={styles.typeName}>
                  {type.label}
                </span>
                <span role="cell" className={styles.typeDetail}>
                  {type.detail}
                </span>
                <span role="cell" className={styles.typeTab}>
                  {type.tabLabel}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.faqSection} aria-labelledby="duvidas">
          <h2 id="duvidas" className={styles.sectionTitle}>
            Dúvidas comuns
          </h2>

          <div className={styles.faqList}>
            {FAQ.map((item) => (
              <details key={item.q} className={styles.faqItem}>
                <summary className={styles.faqQuestion}>{item.q}</summary>
                <p className={styles.faqAnswer}>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.finalCta}>
          <CheckCircleFillIcon size={20} className={styles.finalIcon} />
          <div className={styles.finalBody}>
            <h2 className={styles.finalTitle}>Pronto para publicar?</h2>
            <p className={styles.finalText}>Criar o estúdio leva menos de um minuto — e você pode publicar no mesmo dia.</p>
          </div>
          <StudioCta user={user} loadingUser={loadingUser} myStudios={myStudios} primary />
        </section>
      </div>
    </>
  );
}
