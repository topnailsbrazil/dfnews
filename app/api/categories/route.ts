import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  const supabase = createClient(url, key);
  const { data, error } = await supabase.from("categories").select("id,name,slug").order("name");
  if (error) return NextResponse.json({ error: "Não foi possível carregar categorias editoriais." }, { status: 502 });
  return NextResponse.json((data || []).map((category) => ({ id: String(category.id), name: category.name, slug: category.slug })));
}
