import SeoHead from "@/components/SeoHead";
import styles from "./qrgen.module.css";
import { useState } from "react";
import Image from "next/image";
import { SITE_URL } from "@/lib/seo";
import QrCodeCustomizer, { DEFAULT_QR_SETTINGS } from "@/components/QrCode/QrCodeCustomizer";

const PAGE_TITLE = "Gerador de QR Code Grátis Online | Indies Brasil";
const PAGE_DESCRIPTION =
  "Crie QR Codes personalizados com logo e cores personalizadas. Baixe em PNG gratuitamente, sem cadastro. Ferramenta online para desenvolvedores e criadores.";
const PAGE_URL = `${SITE_URL}/ferramentas/qrgen`;
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Gerador de QR Code — Indies Brasil",
  url: PAGE_URL,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Web",
  inLanguage: "pt-BR",
  description: PAGE_DESCRIPTION,
  offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
};

export default function QrGen() {
  const [linkValue, setLinkValue] = useState("");
  const [settings, setSettings] = useState({ ...DEFAULT_QR_SETTINGS });

  return (
    <main className={styles.container}>
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical={PAGE_URL} jsonLd={JSON_LD} />

      <section className={styles.titleContainer}>
        <h1 className={styles.pageTitle}>
          Gere e customize QR Codes <span>dinâmicos</span>
        </h1>
        <Image src="/images/qr_code.png" alt="detail" width="120" height="200" className={styles.arrowDetail} />
      </section>
      <section className={styles.qrCodeContainer}>
        <QrCodeCustomizer
          value={linkValue}
          onValueChange={setLinkValue}
          settings={settings}
          onChange={setSettings}
          showUrlInput={true}
          showDownload={true}
          size={200}
        />
      </section>
    </main>
  );
}
