import "../css/styles.css";
import "@primer/primitives/dist/css/functional/themes/light.css";
import "@primer/primitives/dist/css/functional/themes/dark.css";

import { BaseStyles, ThemeProvider } from "@primer/react";
import { ThemeProviderCustom } from "@/context/ThemeContext";
import { UserProvider } from "@/context/UserContext";
import Layout from "../components/Layout";
import WhoToFollow from "@/components/WhoToFollow";

export default function MyApp({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <BaseStyles>
        {/* ThemeProviderCustom precisa estar DENTRO do ThemeProvider do Primer */}
        <ThemeProviderCustom>
          <UserProvider>
            <Layout RightSidebar={<WhoToFollow />}>
              <Component {...pageProps} />
            </Layout>
          </UserProvider>
        </ThemeProviderCustom>
      </BaseStyles>
    </ThemeProvider>
  );
}
