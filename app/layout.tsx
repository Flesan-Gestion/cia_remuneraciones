import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { NOMBRE_PLATAFORMA } from "@/lib/nav";
import "./globals.css";

// Fuentes auto-hospedadas (no next/font/google): en redes corporativas con
// inspección TLS, la descarga en caliente de Google Fonts falla y Next cae
// a una fuente de respaldo sin avisar. Los .ttf viven en app/fonts/ (fuente:
// google/fonts, licencia OFL) y se sirven siempre igual sin depender de red.
const barlow = localFont({
  src: [
    { path: "./fonts/barlow/Barlow-Light.ttf", weight: "300", style: "normal" },
    { path: "./fonts/barlow/Barlow-LightItalic.ttf", weight: "300", style: "italic" },
    { path: "./fonts/barlow/Barlow-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/barlow/Barlow-Italic.ttf", weight: "400", style: "italic" },
    { path: "./fonts/barlow/Barlow-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/barlow/Barlow-MediumItalic.ttf", weight: "500", style: "italic" },
    { path: "./fonts/barlow/Barlow-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/barlow/Barlow-SemiBoldItalic.ttf", weight: "600", style: "italic" },
    { path: "./fonts/barlow/Barlow-Bold.ttf", weight: "700", style: "normal" },
    { path: "./fonts/barlow/Barlow-BoldItalic.ttf", weight: "700", style: "italic" },
  ],
  variable: "--font-barlow",
  display: "swap",
});

const barlowCondensed = localFont({
  src: [
    { path: "./fonts/barlow-condensed/BarlowCondensed-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/barlow-condensed/BarlowCondensed-Italic.ttf", weight: "400", style: "italic" },
    { path: "./fonts/barlow-condensed/BarlowCondensed-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/barlow-condensed/BarlowCondensed-MediumItalic.ttf", weight: "500", style: "italic" },
    { path: "./fonts/barlow-condensed/BarlowCondensed-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/barlow-condensed/BarlowCondensed-SemiBoldItalic.ttf", weight: "600", style: "italic" },
    { path: "./fonts/barlow-condensed/BarlowCondensed-Bold.ttf", weight: "700", style: "normal" },
    { path: "./fonts/barlow-condensed/BarlowCondensed-BoldItalic.ttf", weight: "700", style: "italic" },
    { path: "./fonts/barlow-condensed/BarlowCondensed-ExtraBold.ttf", weight: "800", style: "normal" },
    { path: "./fonts/barlow-condensed/BarlowCondensed-ExtraBoldItalic.ttf", weight: "800", style: "italic" },
    { path: "./fonts/barlow-condensed/BarlowCondensed-Black.ttf", weight: "900", style: "normal" },
    { path: "./fonts/barlow-condensed/BarlowCondensed-BlackItalic.ttf", weight: "900", style: "italic" },
  ],
  variable: "--font-barlow-condensed",
  display: "swap",
});

const barlowSemi = localFont({
  src: [
    { path: "./fonts/barlow-semi-condensed/BarlowSemiCondensed-Light.ttf", weight: "300", style: "normal" },
    { path: "./fonts/barlow-semi-condensed/BarlowSemiCondensed-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/barlow-semi-condensed/BarlowSemiCondensed-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/barlow-semi-condensed/BarlowSemiCondensed-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/barlow-semi-condensed/BarlowSemiCondensed-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-barlow-semi",
  display: "swap",
});

// Inter Tight (variable, 100-900) solo para el estilo de reportería: se activa con
// data-estilo="reporte" en una página o bloque (ver globals.css). Formularios y el
// marco de la plataforma siguen en Barlow.
const interTight = localFont({
  src: [{ path: "./fonts/inter-tight/InterTight-Variable.ttf", weight: "100 900", style: "normal" }],
  variable: "--font-inter-tight",
  display: "swap",
});

// La pestaña del navegador lleva siempre el nombre de la plataforma (lib/nav.ts), no el de la
// vista: el template sin %s ignora el título que defina una página.
const TITULO = `${[NOMBRE_PLATAFORMA.texto, NOMBRE_PLATAFORMA.destacado].filter(Boolean).join(" ")} · Grupo Flesan`;

export const metadata: Metadata = {
  title: { default: TITULO, template: TITULO },
  description: "Liquidaciones, libros de remuneraciones y finiquitos de SAP — Grupo Flesan.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E30613" },
    { media: "(prefers-color-scheme: dark)", color: "#0F0F0F" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es-CL"
      suppressHydrationWarning
      className={`${barlow.variable} ${barlowCondensed.variable} ${barlowSemi.variable} ${interTight.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "var(--color-surface)",
                color: "var(--color-text)",
                border: "1px solid var(--color-border)",
                borderRadius: "0",
              },
            }}
          />
          {/* El botón de comentarios CIA lo dibuja el shell dentro del dashboard
              (components/comentarios/widget.tsx) y usa /api/feedback y /api/feedback/mios.
              Ya no se carga el <cia-feedback> central aquí. */}
        </ThemeProvider>
      </body>
    </html>
  );
}
