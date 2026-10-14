import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Data e hora da publicação, mostrada no menu para saber se o navegador já pegou a versão nova.
const VERSAO = new Date().toLocaleString("pt-BR", { timeZone: "America/Asuncion", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default defineConfig({
  define: { __VERSAO__: JSON.stringify(VERSAO) },
  plugins: [
    react(),
    // Deixa o sistema abrir sem internet e permite instalar como aplicativo no computador.
    !process.env.VITE_DEMO &&
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icone.svg", "icone-192.png", "icone-512.png"],
      manifest: {
        name: "Indufarma — Gestão",
        short_name: "Indufarma",
        description: "Estoque, vendas, clientes, fornecedores e caixa da Indufarma.",
        lang: "pt-BR",
        start_url: "/",
        display: "standalone",
        background_color: "#f8fafc",
        theme_color: "#065f46",
        icons: [
          { src: "icone-192.png", sizes: "192x192", type: "image/png" },
          { src: "icone-512.png", sizes: "512x512", type: "image/png" },
          { src: "icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        navigateFallback: "/index.html",
      },
    }),
  ],
});
