import SeoHead from "@/components/SeoHead";
import { useState, useCallback, useRef } from "react";
import { Button } from "@primer/react";
import { PlayIcon, TrashIcon } from "@primer/octicons-react";

import shared from "./toolPage.module.css";
import styles from "./htmlviewer.module.css";
import { SITE_URL } from "@/lib/seo";

// Maximum HTML input size accepted before rendering.
// Prevents excessive memory use in the sandboxed iframe.
const MAX_INPUT_LENGTH = 500_000;

const PAGE_TITLE = "Visualizador de HTML Online | Indies Brasil";
const PAGE_DESCRIPTION = "Cole seu código HTML e visualize a página renderizada em tempo real. Ferramenta online gratuita, segura e sem cadastro.";
const PAGE_URL = `${SITE_URL}/ferramentas/htmlviewer`;
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Visualizador de HTML — Indies Brasil",
  url: PAGE_URL,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  inLanguage: "pt-BR",
  description: PAGE_DESCRIPTION,
  offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
  featureList: "html preview, html viewer, html renderer, sandboxed preview",
};

export default function HtmlViewerPage() {
  const [input, setInput] = useState("");
  const [rendered, setRendered] = useState("");
  const [error, setError] = useState(null);
  const iframeRef = useRef(null);

  const render = useCallback(() => {
    setError(null);

    const raw = input.trim();
    if (!raw) return;

    if (raw.length > MAX_INPUT_LENGTH) {
      setError(`Entrada muito grande. O limite é ${(MAX_INPUT_LENGTH / 1000).toFixed(0)} KB.`);
      return;
    }

    setRendered(raw);
  }, [input]);

  const clear = useCallback(() => {
    setInput("");
    setRendered("");
    setError(null);
  }, []);

  return (
    <div className={shared.container}>
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical={PAGE_URL} jsonLd={JSON_LD} />

      {/* Page header */}
      <header className={shared.pageHeader}>
        <h1 className={shared.pageTitle}>Visualizador de HTML</h1>
        <p className={shared.pageSubtitle}>
          Cole seu código HTML e clique em <strong>Renderizar</strong> para ver a página. A prévia é completamente isolada do site.
        </p>
      </header>

      <div className={shared.workspace}>
        {/* Input panel */}
        <section className={styles.panel}>
          <div className={shared.panelHeader}>
            <span className={shared.panelLabel}>Código HTML</span>
            <Button size="small" variant="invisible" onClick={clear} aria-label="Limpar">
              <TrashIcon size={14} />
              Limpar
            </Button>
          </div>

          <textarea
            className={styles.textarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"Cole seu HTML aqui...\n\n<!DOCTYPE html>\n<html>\n  <body>\n    <h1>Olá mundo!</h1>\n  </body>\n</html>"}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />

          <div className={shared.panelFooter}>
            <span className={shared.charCount}>{input.length > 0 ? `${input.length} caracteres` : ""}</span>
            <Button onClick={render} disabled={!input.trim()}>
              <PlayIcon size={14} />
              Renderizar
            </Button>
          </div>
        </section>

        {/* Preview panel */}
        <section className={styles.panel}>
          <div className={shared.panelHeader}>
            <span className={shared.panelLabel}>
              {"Prévia"}
              <span className={styles.sandboxBadge} title="Executado em sandbox isolada — sem acesso a cookies, localStorage ou ao site">
                sandbox
              </span>
            </span>
          </div>

          {error && <div className={shared.errorBox}>{error}</div>}

          {!error && rendered && (
            /*
             * Security model:
             * - srcdoc: content comes from the string, not a URL — no navigation
             * - sandbox without allow-same-origin: iframe runs in null origin,
             *   so it cannot access parent cookies, localStorage, sessionStorage,
             *   IndexedDB, or the parent DOM under any circumstances.
             * - allow-scripts: lets the user preview JS-driven HTML, but since
             *   there is no allow-same-origin, those scripts are fully isolated.
             * - allow-forms: lets form elements render; submissions stay inside
             *   the sandbox (no allow-top-navigation).
             * - referrerpolicy="no-referrer": suppresses the Referer header on
             *   any outbound requests the previewed page might make.
             * - No allow-top-navigation / allow-popups / allow-modals:
             *   the iframe cannot redirect or control the parent page.
             */
            <iframe
              ref={iframeRef}
              className={styles.preview}
              title="Prévia HTML"
              srcDoc={rendered}
              sandbox="allow-scripts allow-forms"
              referrerPolicy="no-referrer"
            />
          )}

          {!error && !rendered && <div className={shared.emptyOutput}>A prévia renderizada aparecerá aqui.</div>}
        </section>
      </div>
    </div>
  );
}
