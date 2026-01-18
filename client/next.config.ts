import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // En desarrollo, proxear las llamadas /api al backend Express
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3000/api/:path*",
      },
    ];
  },
  // Configuración para producción (static export)
  output: "standalone",
};

export default nextConfig;
