import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization") || "";
  const webhook = process.env.N8N_PWA_RESULT_WEBHOOK_URL;
  const secret = process.env.N8N_PWA_RESULT_SECRET;
  if (!url || !key || !authorization) return NextResponse.json({ error: "Sessão editorial inválida." }, { status: 401 });
  if (!webhook || !secret) return NextResponse.json({ error: "Webhook de retorno do n8n não configurado." }, { status: 503 });
  const supabase = createClient(url, key, { global: { headers: { Authorization: authorization } } });
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return NextResponse.json({ error: "Sessão editorial inválida." }, { status: 401 });
  const { data: article, error } = await supabase.from("articles").select("*").eq("id", params.id).single();
  if (error || !article) return NextResponse.json({ error: "Matéria não encontrada." }, { status: 404 });
  const payload = {
    event_id: `pwa_${article.id}_${article.version}_${Date.now()}`,
    article_id: article.id,
    n8n_item_id: article.n8n_item_id,
    title: article.title,
    excerpt: article.excerpt,
    content: article.content,
    category_id: article.category_id,
    author: article.author,
    tags: article.tags || [],
    image_url: article.image_url,
    cover_image_url: article.cover_image_url,
    image_credit: article.image_credit,
    source_name: article.source_name,
    source_url: article.source_url,
    editorial_status: article.editorial_status,
    wordpress_post_id: article.wordpress_post_id,
    wordpress_media_id: article.wordpress_media_id,
    cover_media_id: article.cover_media_id,
    wordpress_url: article.wordpress_url,
    last_error: article.last_error,
    updated_at: article.updated_at,
  };
  const response = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json", "x-dfja-pwa-secret": secret }, body: JSON.stringify(payload) });
  if (!response.ok) return NextResponse.json({ error: `n8n recusou o retorno (${response.status}).` }, { status: 502 });
  return NextResponse.json({ ok: true, event_id: payload.event_id });
}
