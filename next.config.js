/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Let Next.js transpile @primer packages so their CSS imports are handled correctly
  transpilePackages: ["@primer/react", "@primer/primitives"],
  compiler: {
    styledComponents: true,
  },
};

module.exports = nextConfig;
