import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O Windows expõe a interface do WSL (172.25.112.1); sem isso o HMR é bloqueado.
  allowedDevOrigins: ["172.25.112.1"],
  experimental: {
    serverActions: {
      // Upload do .xlsx na importação vai por Server Action; a 6wla.xlsx real tem ~1,1 MB.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
