/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize for API-only usage
  reactStrictMode: true,
  
  // Enable experimental features for better serverless performance
  experimental: {
    // Optimize serverless function size
  },

  // Headers for Excel/external access
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-API-Key, Content-Type, Authorization' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
