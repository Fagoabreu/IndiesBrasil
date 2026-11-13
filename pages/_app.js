import "../css/styles.css";

import App from "next/app";
import PropTypes from "prop-types";
import { parse } from "cookie";
import { Inter } from "next/font/google";
import { ThemeProvider, BaseStyles } from "@primer/react";
import { UserProvider } from "@/context/UserContext";
import Layout from "@/components/Layout";
import { useRouter } from "next/router";
import "@primer/primitives/dist/css/functional/themes/light.css";
import "@primer/primitives/dist/css/functional/themes/dark.css";
// Depois dos temas do Primer de propósito: precisa vencer por ordem de cascata
// (ver o cabeçalho do arquivo).
import "../css/theme-dark.css";

/**
 * Fonte da aplicação. `next/font/google` baixa no build e serve do próprio
 * domínio (a CSP de produção é `font-src 'self'`), então não há requisição a
 * terceiros em runtime; `display: "swap"` mostra o fallback até a fonte chegar.
 *
 * A classe `inter.variable` define `--font-inter` e é aplicada no wrapper
 * abaixo. Ela **não** pode ir no `<html>`: só o `_document` escreve ali, e
 * `next/font` é proibido dentro dele. Por isso `--font-sans` em
 * `css/styles.css` também cita `"Inter"` como fallback: o `@font-face` é
 * global, então portais do Primer (que são anexados ao `document.body`, fora
 * do wrapper) continuam com a mesma família em vez de cair no Segoe UI.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// Lê o tema salvo do cookie de forma segura (aceita apenas "day" ou "night").
function readThemeFromCookie(cookieHeader) {
  const cookies = parse(cookieHeader || "");
  const value = cookies["theme-mode"];
  return value === "night" || value === "day" ? value : "auto";
}

export default function MyApp({ Component, pageProps, colorMode }) {
  const router = useRouter();
  const RightSidebar = Component.RightSidebar || null;
  const noLayout = Component.noLayout || false;

  return (
    // colorMode vem do cookie (server) ou localStorage (client) via getInitialProps.
    // Servidor e cliente recebem o mesmo valor via __NEXT_DATA__ — sem hydration mismatch.
    // Sem cookie (primeira visita), usa "auto" (preferência do sistema).
    // O wrapper com `inter.variable` é só o escopo da variável de fonte: não
    // tem estilo próprio, então não interfere no layout de 100dvh do Layout.
    <div className={inter.variable}>
      <ThemeProvider colorMode={colorMode}>
        <BaseStyles>
          <UserProvider>
            {noLayout ? (
              <div key={router.asPath} className="page-transition">
                <Component {...pageProps} />
              </div>
            ) : (
              <Layout RightSidebar={RightSidebar}>
                <div key={router.asPath} className="page-transition">
                  <Component {...pageProps} />
                </div>
              </Layout>
            )}
          </UserProvider>
        </BaseStyles>
      </ThemeProvider>
    </div>
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
