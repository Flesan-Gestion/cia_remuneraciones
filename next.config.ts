import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Oculta el ícono flotante de Next.js Dev Tools (indicador de build/ruta) en desarrollo.
  devIndicators: false,
  // Genera bundle autónomo en .next/standalone/ para Docker (imagen mínima).
  output: "standalone",
  // pdfkit lee sus fuentes (.afm) del disco: va como paquete externo, no empaquetado.
  serverExternalPackages: ["pdfkit"],
  // Archivos que se leen en tiempo de ejecución y deben ir en la imagen standalone.
  outputFileTracingIncludes: {
    "/**/*": ["./lib/liquidaciones/fuentes/**/*", "./lib/libro/logo.png", "./node_modules/pdfkit/js/data/**/*", "./maestro_colaborador.sql"],
  },
};

export default nextConfig;
