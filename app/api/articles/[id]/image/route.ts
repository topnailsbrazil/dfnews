import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const wpBase = (process.env.WORDPRESS_URL || "https://dfja.com.br")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/wp-json(?:\/wp\/v2)?$/i, "");

function supabaseFor(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization") || "";
  if (!url || !key || !authorization) return null;
  return createClient(url, key, { global: { headers: { Authorization: authorization } } });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const wpUser = process.env.WORDPRESS_USERNAME;
  const wpPassword = process.env.WORDPRESS_APPLICATION_PASSWORD;
  if (!wpUser || !wpPassword) return NextResponse.json({ error: "Credenciais do WordPress não configuradas no servidor." }, { status: 503 });
  const supabase = supabaseFor(request);
  if (!supabase) return NextResponse.json({ error: "Sessão editorial ausente." }, { status: 401 });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Sessão editorial inválida." }, { status: 401 });

  const { data: article, error: articleError } = await supabase.from("articles").select("id").eq("id", params.id).single();
  if (articleError || !article) return NextResponse.json({ error: "Matéria não encontrada." }, { status: 404 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Selecione uma imagem válida." }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "O arquivo precisa ser uma imagem." }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "A imagem deve ter no máximo 8 MB." }, { status: 413 });

  const auth = `Basic ${Buffer.from(`${wpUser}:${wpPassword}`).toString("base64")}`;
  const response = await fetch(`${wpBase}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Disposition": `attachment; filename=${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`, "Content-Type": file.type },
    body: Buffer.from(await file.arrayBuffer()),
  });
  if (!response.ok) {
    const body = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 240);
    return NextResponse.json({ error: `Upload da imagem no WordPress falhou (${response.status})${body ? `: ${body}` : ""}` }, { status: 502 });
  }
  const media = await response.json();
  const now = new Date().toISOString();
  const update = await supabase.from("articles").update({ wordpress_media_id: Number(media.id), image_url: media.source_url || null, updated_at: now }).eq("id", article.id);
  if (update.error) return NextResponse.json({ error: `Imagem enviada, mas não foi vinculada à matéria: ${update.error.message}` }, { status: 502 });
  return NextResponse.json({ ok: true, mediaId: Number(media.id), url: media.source_url || null });
}
