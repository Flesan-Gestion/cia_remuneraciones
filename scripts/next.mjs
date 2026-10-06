// Corre `next` (dev/start) con los certificados de Windows (--use-system-ca, para la inspección
// TLS de la red corporativa) cuando esta versión de Node lo permite (22.15+). En Node 20 la opción
// no existe y Node se niega a partir si viene en NODE_OPTIONS: ahí corre sin ella.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ca = process.allowedNodeEnvironmentFlags.has("--use-system-ca") ? "--use-system-ca" : "";
const env = { ...process.env, NODE_OPTIONS: [process.env.NODE_OPTIONS, ca].filter(Boolean).join(" ") };

const next = spawn(process.execPath, [require.resolve("next/dist/bin/next"), ...process.argv.slice(2)], { env, stdio: "inherit" });
next.on("exit", (codigo, senal) => process.exit(codigo ?? (senal ? 1 : 0)));
