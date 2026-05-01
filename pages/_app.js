import "../css/styles.css";

import App from "next/app";
import PropTypes from "prop-types";
import { parse } from "cookie";
import { ThemeProvider, BaseStyles } from "@primer/react";
import { UserProvider } from "@/context/UserContext";
import Layout from "@/components/Layout";
import "@primer/primitives/dist/css/functional/themes/light.css";
import "@primer/primitives/dist/css/functional/themes/dark.css";

// Lê o tema salvo do cookie de forma segura (aceita apenas "day" ou "night").
function readThemeFromCookie(cookieHeader) {
  const cookies = parse(cookieHeader || "");
  const value = cookies["theme-mode"];
  return value === "night" || value === "day" ? value : "auto";
}

export default function MyApp({ Component, pageProps, colorMode }) {
  const RightSidebar = Component.RightSidebar || null;

  return (
    // colorMode vem do cookie (server) ou localStorage (client) via getInitialProps.
    // Servidor e cliente recebem o mesmo valor via __NEXT_DATA__ — sem hydration mismatch.
    // Sem cookie (primeira visita), usa "auto" (preferência do sistema).
    <ThemeProvider colorMode={colorMode}>
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

MyApp.getInitialProps = async (appContext) => {
  const appProps = await App.getInitialProps(appContext);

  let colorMode = "auto";
  try {
    if (appContext.ctx.req) {
      // Lado servidor: lê o cookie do cabeçalho da requisição.
      const cookieHeader = appContext.ctx.req.headers.cookie || "";
      colorMode = readThemeFromCookie(cookieHeader);
    } else {
      // Navegação client-side: lê do cookie do documento.
      const cookies = parse(document.cookie);
      const saved = cookies["theme-mode"];
      if (saved === "night" || saved === "day") colorMode = saved;
    }
  } catch {
    // Ambiente sem acesso a cookie (ex: SSR sem req).
  }

  return { ...appProps, colorMode };
};

MyApp.propTypes = {
  Component: PropTypes.elementType.isRequired,
  pageProps: PropTypes.object.isRequired,
  colorMode: PropTypes.oneOf(["auto", "day", "night"]),
};

MyApp.defaultProps = {
  colorMode: "auto",
};
