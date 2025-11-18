import "../css/styles.css"; // opcional, se você tiver estilos próprios
import "@primer/primitives/dist/css/functional/themes/light.css";
import { BaseStyles, ThemeProvider } from "@primer/react";
import Layout from "../components/Layout";

export default function MyApp({ Component, pageProps }) {
  return (
    <ThemeProvider colorMode="auto">
      <BaseStyles>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </BaseStyles>
    </ThemeProvider>
  );
}
