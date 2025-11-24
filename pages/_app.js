import "../css/styles.css"; // opcional, se você tiver estilos próprios
import "@primer/primitives/dist/css/functional/themes/light.css";
import { BaseStyles, ThemeProvider } from "@primer/react";
import Layout from "../components/Layout";
import { UserProvider } from "@/context/UserContext.js";

export default function MyApp({ Component, pageProps }) {
  return (
    <ThemeProvider colorMode="auto">
      <BaseStyles>
        <UserProvider>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </UserProvider>
      </BaseStyles>
    </ThemeProvider>
  );
}
