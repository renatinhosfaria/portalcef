/** @type {import('next').NextConfig} */
module.exports = {
  output: "standalone",
  transpilePackages: ["@essencia/ui", "@essencia/shared"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.portalcef.com.br", pathname: "/storage/**" },
      { protocol: "http", hostname: "minio", pathname: "/**" },
      { protocol: "http", hostname: "localhost", pathname: "/storage/**" },
      { protocol: "http", hostname: "127.0.0.1", pathname: "/storage/**" },
    ],
  },
};
