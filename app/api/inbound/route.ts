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
  const categoryName = String(body.categoria || body.category || "").trim();
  let categoryId: string | null = body.category_id ? String(body.category_id) : null;
  if (!categoryId && categoryName) {
    const slug = categoryName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, "-e-").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const bySlug = await supabase.from("categories").select("id").eq("slug", slug).maybeSingle();
    if (bySlug.data?.id) categoryId = bySlug.data.id;
    else {
      const byName = await supabase.from("categories").select("id").eq("name", categoryName).maybeSingle();
      categoryId = byName.data?.id || null;
    }
  }
  const row = { title: String(body.title), slug: String(body.slug || `${body.n8n_item_id}-${Date.now()}`).toLowerCase().replace(/[^a-z0-9-]+/g, "-"), excerpt: body.excerpt || null, content: String(body.content), image_url: body.image_url || null, image_credit: body.image_credit || null, source_name: body.source_name || null, source_url: body.source_url || null, author: body.author || "Redação", tags: Array.isArray(body.tags) ? body.tags.map(String) : [], category_id: categoryId, n8n_item_id: String(body.n8n_item_id), editorial_status: "reescrita_ia", ai_status: "concluida", status: "review", published_at: body.published_at || null, updated_at: new Date().toISOString() };
  // Older prototype databases may not have a UNIQUE constraint on n8n_item_id.
  // Resolve idempotency explicitly so inbound processing works on both schemas.
  const existing = await supabase.from("articles").select("id").eq("n8n_item_id", row.n8n_item_id).limit(1).maybeSingle();
  if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 502 });

  let data: { id: string; n8n_item_id: string; editorial_status: string } | null = null;
  let error: { message: string } | null = null;
  if (existing.data?.id) {
    const result = await supabase.from("articles").update(row).eq("id", existing.data.id).select("id,n8n_item_id,editorial_status").single();
    data = result.data;
    error = result.error;
  } else {
    const result = await supabase.from("articles").insert(row).select("id,n8n_item_id,editorial_status").single();
    data = result.data;
    error = result.error;
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  return NextResponse.json({ ok: true, article: data });
}
