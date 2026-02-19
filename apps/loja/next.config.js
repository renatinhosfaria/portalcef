/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    transpilePackages: ["@essencia/ui", "@essencia/components", "@essencia/shared"],

    // Configuração de imagens para MinIO e Storage
    images: {
        remotePatterns: [
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '9000',
                pathname: '/essencia-uploads/**',
            },
            {
                protocol: 'https',
                hostname: 'minio.essencia.edu.br',
                pathname: '/essencia-uploads/**',
            },
            {
                protocol: 'https',
                hostname: 'www.portalcef.com.br',
                pathname: '/storage/**',
            },
        ],
    },

    // Docker/Windows file watching support
    webpack: (config, { isServer }) => {
        // Enable polling for file changes in Docker environments
        if (process.env.DOCKER_ENV === "true") {
            config.watchOptions = {
                poll: 1000, // Check for changes every second
                aggregateTimeout: 300,
                ignored: /node_modules|\.next|\.turbo|dist|coverage|\.git/,
            };
        }
        return config;
    },
};

module.exports = nextConfig;
