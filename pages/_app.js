import "bootstrap/dist/css/bootstrap.min.css";
import "../css/styles.css"; // opcional, se você tiver estilos próprios
import "@primer/primitives/dist/css/functional/themes/light.css";

import Layout from "../components/Layout";
import { useEffect } from "react";
import { BaseStyles, ThemeProvider } from "@primer/react";

export default function MyApp({ Component, pageProps }) {
  useEffect(() => {
    import("bootstrap/dist/js/bootstrap.bundle.min");
  });
  return (
    <ThemeProvider>
      <BaseStyles>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </BaseStyles>
    </ThemeProvider>
  );
}
