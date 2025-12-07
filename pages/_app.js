import "../css/styles.css";

import "@primer/primitives/dist/css/functional/themes/light.css";
import "@primer/primitives/dist/css/functional/themes/dark.css";

import { ThemeProvider } from "@primer/react";
import { UserProvider } from "@/context/UserContext";
import Layout from "@/components/Layout";

export default function App({ Component, pageProps }) {
  const RightSidebar = Component.RightSidebar || null;

  return (
    <ThemeProvider colorMode="auto" dayScheme="light" nightScheme="dark" enableSystem={false} enableColorScheme={true}>
      <UserProvider>
        <Layout RightSidebar={RightSidebar}>
          <Component {...pageProps} />
        </Layout>
      </UserProvider>
    </ThemeProvider>
  );
}
