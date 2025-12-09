import "../css/styles.css";

import { BaseStyles, ThemeProvider } from "@primer/react";
import { UserProvider } from "@/context/UserContext";
import Layout from "@/components/Layout";
import "@primer/primitives/dist/css/functional/themes/light.css"; // Example import
import "@primer/primitives/dist/css/functional/themes/dark.css";

export default function App({ Component, pageProps }) {
  const RightSidebar = Component.RightSidebar || null;

  return (
    <ThemeProvider colorMode="auto" preventSSRMismatch>
      <BaseStyles>
        <UserProvider>
          <Layout RightSidebar={RightSidebar}>
            <Component {...pageProps} />
          </Layout>
        </UserProvider>
      </BaseStyles>
    </ThemeProvider>
  );
}
