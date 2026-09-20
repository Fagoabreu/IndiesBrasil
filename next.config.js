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
  i18n: {
    locales: ["pt-BR", "en-US", "fr", "es"],
    defaultLocale: "pt-BR",
    localeDetection: false,
  },
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
    ];
  },
};

module.exports = nextConfig;
