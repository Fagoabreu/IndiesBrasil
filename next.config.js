/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  /**
   * O sharp é usado pelas rotas de Open Graph (`pages/api/og/**`) para
   * rasterizar o card SVG em PNG. O file tracing do Next copia o binding nativo
   * (`sharp-<plataforma>.node`) mas **deixa para trás** as bibliotecas
   * compartilhadas dele (`libvips-*.dll` no Windows,
   * `@img/sharp-libvips-*` no Linux) — sem elas o `require("sharp")` falha no
   * build standalone, que é exatamente o que vai para produção.
   */
  outputFileTracingIncludes: {
    "/api/og/**": ["./node_modules/sharp/**/*", "./node_modules/@img/**/*"],
  },
  /**
   * Sem `i18n`: o site tem um idioma só (o conteúdo é escrito em português e o
   * `SeoHead` já declara `pt-BR` e `content-language`). A configuração existia
   * com quatro locales e `localeDetection: false`, o que mantinha três cópias
   * de cada página em português — `/en-US/jogos`, `/fr/jogos`, `/es/jogos` —
   * todas sem tradução e todas apontando para a mesma canonical. Isso divide o
   * rastreamento entre URLs duplicadas e não dá nada em troca. Uma verificação
   * no código confirmou que nada lê `router.locale` nem linka URL com prefixo,
   * então remover não quebra endereço nenhum em uso.
   */
  transpilePackages: ["@primer/react", "@primer/primitives"],
  compiler: {
    styledComponents: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "static-cdn.jtvnw.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.cloudinary.com",
      },
    ],
  },

  async rewrites() {
    return [
      {
        source: "/favicon.ico",
        destination: "/images/logo.png",
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
      {
        /**
         * `Disallow: /admin/` no `robots.txt` proíbe o RASTREIO, não a
         * indexação: se outra página linkar um endereço de admin (ou o próprio
         * Google decidir indexar a URL que viu em algum lugar), ela pode entrar
         * no índice mesmo assim. `X-Robots-Tag: noindex` é a instrução que
         * remove — e, ao contrário do `noindex` no HTML, funciona também nas
         * respostas de API, que não têm `<head>`.
         */
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

module.exports = nextConfig;
