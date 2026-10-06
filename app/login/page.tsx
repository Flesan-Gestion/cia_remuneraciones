import { signIn } from "@/auth";
import { CiaLogo } from "@/components/cia-logo";

// Auth.js manda errores a esta misma página (pages.error = "/login").
const ERRORES: Record<string, string> = {
  AccessDenied: "Tu cuenta no pertenece a un dominio autorizado.",
  Configuration: "El login aún no está configurado en el servidor (variables AUTH_*).",
  Verification: "El enlace de acceso expiró. Intentá de nuevo.",
  default: "No se pudo iniciar sesión. Intentá nuevamente.",
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="shrink-0">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;
  const mensajeError = error ? (ERRORES[error] ?? ERRORES.default) : null;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0a] px-4">
      {/* Glow ambiental de marca */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-1/3 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full opacity-20 blur-[120px]"
        style={{ background: "radial-gradient(circle, #E30613 0%, transparent 70%)" }}
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl border border-white/[0.08] bg-[#161616]/80 p-10 shadow-2xl backdrop-blur-xl">
          {/* Marca — TODO: reemplazar por el logo real de la plataforma (public/brand/) */}
          <div className="flex flex-col items-center text-center">
            <CiaLogo className="w-14 h-14 mb-5 text-white" />
            <h1 className="font-display text-3xl font-extrabold italic uppercase tracking-tight text-text leading-none">
              Remuneraciones SAP
            </h1>
            <p className="mt-2 font-label text-[11px] font-semibold uppercase tracking-[0.25em] text-flesan-warm">
              Grupo Flesan
            </p>
            <div className="my-6 h-px w-16 bg-white/10" />
            <p className="font-body text-sm text-flesan-light">
              Ingresa con tu cuenta corporativa de Google
            </p>
            <p className="mt-1 font-body text-xs text-flesan-steel">
              Dominios autorizados: flesan.cl
            </p>
          </div>

          {/* Botón de Google */}
          <div className="mt-8 flex flex-col items-center justify-center">
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: callbackUrl || "/" });
              }}
            >
              <button
                type="submit"
                className="flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.04] px-6 py-3 font-label text-xs uppercase tracking-[0.1em] text-white hover:bg-white/[0.08] hover:border-white/25 transition-colors cursor-pointer"
              >
                <GoogleIcon />
                Iniciar sesión con Google
              </button>
            </form>
            {mensajeError && (
              <p className="mt-4 font-body text-sm text-flesan-red text-center" role="alert">
                {mensajeError}
              </p>
            )}
          </div>
        </div>

        <p className="mt-6 text-center font-label text-[11px] tracking-wider text-flesan-steel">
          Grupo Flesan
        </p>
      </div>
    </main>
  );
}
