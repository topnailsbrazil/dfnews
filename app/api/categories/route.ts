import { NextResponse } from "next/server";

export async function GET() {
  const base = process.env.WORDPRESS_URL || "https://dfja.com.br";
  try {
    const response = await fetch(`${base}/wp-json/wp/v2/categories?per_page=100&hide_empty=false`, { next: { revalidate: 300 } });
    if (!response.ok) return NextResponse.json({ error: "Não foi possível carregar categorias do WordPress." }, { status: 502 });
    const categories = (await response.json()).map((category: { id: number; name: string }) => ({ id: String(category.id), name: category.name }));
    return NextResponse.json(categories);
  } catch { return NextResponse.json({ error: "WordPress indisponível." }, { status: 502 }); }
}
