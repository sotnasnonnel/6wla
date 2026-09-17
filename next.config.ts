import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imagem Docker enxuta: o build gera um servidor Node autocontido
  // (.next/standalone). Ver Dockerfile e docs/DEPLOY.md.
  output: "standalone",
  // O Windows expõe a interface do WSL (172.25.112.1); sem isso o HMR é bloqueado.
  allowedDevOrigins: ["172.25.112.1"],
  experimental: {
    // Voltar a uma aba visitada há pouco reaproveita a tela já renderizada.
    // Mutações chamam revalidatePath e o Realtime chama router.refresh, que
    // descartam esse cache; o risco é só ver dado de outra pessoa com até
    // 30s de atraso numa tela sem Realtime.
    staleTimes: { dynamic: 30 },
    serverActions: {
      // Upload do .xlsx na importação vai por Server Action; a 6wla.xlsx real tem ~1,1 MB.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
