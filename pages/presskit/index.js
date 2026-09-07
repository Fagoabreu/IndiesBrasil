import Image from "next/image";
import Link from "next/link";
import SeoHead from "@/components/SeoHead";
import { SITE_URL, SITE_NAME } from "@/lib/seo";
import { downloadPressKitPdf } from "lib/presskit-pdf";
import styles from "./presskit.module.css";

const PAGE_TITLE = "Press Kit — Indies Brasil";
const PAGE_DESCRIPTION =
  "Material de imprensa da Indies Brasil: factsheet, boilerplate, público e contatos para cobertura da maior comunidade de jogos independentes do Brasil.";

const FACTSHEET = [
  ["Desenvolvedor", "Indies Brasil"],
  ["Website", SITE_URL.replace(/^https?:\/\//, "")],
  ["Contato de imprensa", "contato@indies.com.br"],
  ["Preço", "Gratuito"],
  ["Plataformas", "Web (navegador)"],
  ["Categoria", "Rede social / Comunidade de jogos independentes"],
  ["Idioma", "Português (Brasil)"],
];

const BOILERPLATE_SHORT =
  "A Indies Brasil é a rede social da indústria brasileira de jogos independentes — um ponto de encontro para desenvolvedores, artistas e público gamer criarem, divulgarem e descobrirem jogos nacionais.";

const BOILERPLATE_LONG =
  "A Indies Brasil conecta toda a cadeia de produção de jogos independentes no país. Desenvolvedores, artistas, roteiristas, músicos e designers montam portfólios profissionais, formam estúdios, publicam obras (jogos digitais, jogos de mesa, livros e quadrinhos) e divulgam seu trabalho para uma comunidade ativa de gamers e criadores. A plataforma também serve de vitrine para a imprensa, eventos e parceiros de negócios que buscam conhecer o cenário indie nacional.";

const AUDIENCES = [
  "Membros — artistas, programadores, roteiristas, músicos e desenvolvedores de jogos que constroem portfólios e formam estúdios.",
  "Público gamer — jogadores que descobrem, seguem e apoiam jogos e estúdios independentes brasileiros.",
  "Mídia e negócios — jornais, revistas, eventos, publicadoras e investidores que cobrem ou apoiam o cenário indie.",
];

const PILLARS = [
  "Portfólio profissional com projetos, habilidades e histórico.",
  "Estúdios com pitch, equipe, contatos e press kit próprio.",
  "Catálogos de jogos digitais, jogos de mesa, livros e quadrinhos.",
  "Feed social com embeds de YouTube, Twitch, Steam e Instagram.",
  "Sistema de tags para descoberta e tendências.",
  "Cursos, notícias, análises e agenda de eventos do cenário indie.",
  "Reputação da comunidade e loja integrada.",
];

function buildPdfBlocks() {
  return [
    { type: "title", text: SITE_NAME },
    { type: "subtitle", text: "Press Kit — Rede social de desenvolvedores indie brasileiros" },
    { type: "h2", text: "Factsheet" },
    ...FACTSHEET.map(([label, value]) => ({ type: "fact", label, value })),
    { type: "h2", text: "Descrição" },
    { type: "p", text: BOILERPLATE_LONG },
    { type: "h2", text: "Públicos" },
    ...AUDIENCES.map((text) => ({ type: "bullet", text })),
    { type: "h2", text: "Recursos da plataforma" },
    ...PILLARS.map((text) => ({ type: "bullet", text })),
    { type: "h2", text: "Contato" },
    { type: "p", text: "Imprensa, parcerias e negócios: contato@indies.com.br" },
  ];
}

export default function PressKitPage() {
  function handleDownload() {
    downloadPressKitPdf({ blocks: buildPdfBlocks() }, "indies-brasil-press-kit.pdf");
  }

  return (
    <>
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical={`${SITE_URL}/presskit`} />

      {/* Barra de ação — oculta no print */}
      <div className={styles.printBar}>
        <p className={styles.printHint}>
          Press Kit de <strong>{SITE_NAME}</strong> ·{" "}
          <Link href="/" className={styles.backLink}>
            voltar ao site
          </Link>
        </p>
        <button type="button" className={styles.downloadBtn} onClick={handleDownload}>
          ⬇ Baixar PDF
        </button>
      </div>

      <main className={styles.page}>
        {/* Cabeçalho */}
        <header className={styles.header}>
          <Image src="/images/logo.png" alt={`Logo ${SITE_NAME}`} width={96} height={96} className={styles.logo} unoptimized />
          <div className={styles.headerText}>
            <h1 className={styles.name}>{SITE_NAME}</h1>
            <p className={styles.tagline}>Rede social de desenvolvedores indie brasileiros</p>
          </div>
        </header>

        <div className={styles.layout}>
          {/* Factsheet */}
          <aside className={styles.factsheet}>
            <h2 className={styles.sidebarTitle}>Factsheet</h2>
            <dl className={styles.factList}>
              {FACTSHEET.map(([label, value]) => (
                <div key={label} className={styles.factRow}>
                  <dt className={styles.factLabel}>{label}</dt>
                  <dd className={styles.factValue}>{value}</dd>
                </div>
              ))}
            </dl>
          </aside>

          {/* Conteúdo */}
          <article className={styles.content}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Descrição</h2>
              <p className={styles.lead}>{BOILERPLATE_SHORT}</p>
              <p className={styles.body}>{BOILERPLATE_LONG}</p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Públicos</h2>
              <ul className={styles.list}>
                {AUDIENCES.map((audience) => (
                  <li key={audience} className={styles.listItem}>
                    {audience}
                  </li>
                ))}
              </ul>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Recursos da plataforma</h2>
              <ul className={styles.list}>
                {PILLARS.map((pillar) => (
                  <li key={pillar} className={styles.listItem}>
                    {pillar}
                  </li>
                ))}
              </ul>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Contato</h2>
              <p className={styles.body}>
                Imprensa, parcerias e negócios:{" "}
                <a href="mailto:contato@indies.com.br" className={styles.link}>
                  contato@indies.com.br
                </a>
              </p>
            </section>
          </article>
        </div>

        <footer className={styles.footer}>
          <span>Gerado em {new Intl.DateTimeFormat("pt-BR").format(new Date())}</span>
          <span>{SITE_URL.replace(/^https?:\/\//, "")}</span>
        </footer>
      </main>
    </>
  );
}

PressKitPage.noLayout = true;
