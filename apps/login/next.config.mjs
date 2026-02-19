/** @type {import('next').NextConfig} */
const nextConfig = {
    basePath: "/login",
    output: "standalone",
    transpilePackages: ["@essencia/ui"],
};

export default nextConfig;
