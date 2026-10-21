import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O F.O.G.O. é um painel ao vivo (SSE + SQLite local): não há o que pré-renderizar,
  // então ficamos fora de cacheComponents/partialPrefetching e tudo roda por requisição.
  // better-sqlite3 é nativo e precisa ficar fora do bundle do servidor.
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
