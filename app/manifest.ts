import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "DFJÁ Central Editorial", short_name: "DFJÁ Editorial", description: "Revisão e publicação editorial do DFJÁ.", start_url: "/admin", display: "standalone", background_color: "#f3f6f8", theme_color: "#147d6e", lang: "pt-BR", icons: [] };
}
