/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    images: {
        unoptimized: true,
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'imgproxy.zlkpro.tech',
                pathname: '/**'
            },
            {
                protocol: 'https',
                hostname: 'bucket.zlkcyber.tech',
                pathname: '/**'
            }
        ],
    }
};

export default nextConfig;
