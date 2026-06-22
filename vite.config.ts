import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

// Standalone Vite config (replaces the previous generated config wrapper).
// Wires the same essential plugins the project relies on:
//   - @tailwindcss/vite        : Tailwind v4 pipeline
//   - vite-tsconfig-paths      : resolves the "@/*" path alias from tsconfig
//   - @tanstack/react-start    : SSR + server entry (src/server.ts)
//   - @vitejs/plugin-react     : React fast refresh / JSX
export default defineConfig(({ mode }) => {
  // Expose VITE_* vars to import.meta.env on both client and server bundles.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return {
    define: envDefine,
    resolve: {
      alias: {
        "@": `${process.cwd()}/src`,
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        // Use src/server.ts as the SSR entry (our error-wrapping handler).
        server: { entry: "server" },
        // Prevent server-only modules from leaking into the client bundle.
        importProtection: {
          behavior: "error",
          client: {
            files: ["**/server/**"],
            specifiers: ["server-only"],
          },
        },
      }),
      viteReact(),
    ],
  };
});
