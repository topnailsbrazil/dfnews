import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DFNews — Distrito Federal e Centro-Oeste",
  description: "Notícias do Distrito Federal, entorno e Centro-Oeste.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
