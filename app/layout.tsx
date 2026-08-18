import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DFJÁ — Distrito Federal e Entorno",
  description: "Notícias do Distrito Federal e do Entorno.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
