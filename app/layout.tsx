import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "./ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "DFJÁ — Distrito Federal e Entorno",
  description: "Notícias do Distrito Federal e do Entorno.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#147d6e" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body><ServiceWorkerRegister />{children}</body>
    </html>
  );
}
