/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@essencia/ui', '@essencia/shared'],
  images: {
    domains: ['localhost'], // MinIO URL será adicionado em produção
  },
};

export default nextConfig;
