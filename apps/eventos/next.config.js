/** @type {import('next').NextConfig} */
module.exports = {
  output: "standalone",
  transpilePackages: ["@essencia/ui", "@essencia/shared", "@essencia/components"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.portalcef.com.br", pathname: "/storage/**" },
      { protocol: "https", hostname: "minio.essencia.edu.br", pathname: "/essencia-uploads/**" },
      { protocol: "http", hostname: "localhost", port: "9000", pathname: "/essencia-uploads/**" },
    ],
  },
};
