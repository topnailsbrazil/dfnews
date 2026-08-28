import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const expected = process.env.N8N_PWA_INBOUND_SECRET;
  if (!expected || request.headers.get("x-dfja-pwa-secret") !== expected) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." }, { status: 503 });
  const body = await request.json();
  if (!body.n8n_item_id || !body.title || !body.content) return NextResponse.json({ error: "n8n_item_id, title e content são obrigatórios." }, { status: 400 });
  const supabase = createClient(url, serviceKey);
  const row = { title: String(body.title), slug: String(body.slug || `${body.n8n_item_id}-${Date.now()}`).toLowerCase().replace(/[^a-z0-9-]+/g, "-"), excerpt: body.excerpt || null, content: String(body.content), image_url: body.image_url || null, image_credit: body.image_credit || null, source_name: body.source_name || null, source_url: body.source_url || null, author: body.author || "Redação", tags: Array.isArray(body.tags) ? body.tags.map(String) : [], n8n_item_id: String(body.n8n_item_id), editorial_status: "reescrita_ia", ai_status: "concluida", status: "review", updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from("articles").upsert(row, { onConflict: "n8n_item_id" }).select("id,n8n_item_id,editorial_status").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  return NextResponse.json({ ok: true, article: data });
}
