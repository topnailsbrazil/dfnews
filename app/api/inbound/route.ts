import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const expected = process.env.N8N_PWA_INBOUND_SECRET;
  if (!expected || request.headers.get("x-dfja-pwa-secret") !== expected)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey)
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." },
      { status: 503 },
    );
  const body = await request.json();
  const decision = String(body.decisao || body.decision || body.action || "")
    .trim()
    .toLowerCase();
  if (!["aprovar", "processar", "aprovado", "approved"].includes(decision))
    return NextResponse.json(
      { error: "Matéria bloqueada: somente itens aprovados no Telegram podem entrar no PWA." },
      { status: 403 },
    );
  if (!body.n8n_item_id || !body.title || !body.content)
    return NextResponse.json(
      { error: "n8n_item_id, title e content são obrigatórios." },
      { status: 400 },
    );
  const supabase = createClient(url, serviceKey);
  const wpBase = (process.env.WORDPRESS_URL || "https://dfja.com.br")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/wp-json(?:\/wp\/v2)?$/i, "");
  const categoryName = String(body.categoria || body.category || "").trim();
  let categoryId: string | null = body.category_id
    ? String(body.category_id)
    : null;
  if (!categoryId && categoryName) {
    const slug = categoryName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, "-e-")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const bySlug = await supabase
      .from("categories")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (bySlug.data?.id) categoryId = bySlug.data.id;
    else {
      const byName = await supabase
        .from("categories")
        .select("id")
        .eq("name", categoryName)
        .maybeSingle();
      categoryId = byName.data?.id || null;
    }
  }
  const row = {
    title: String(body.title),
    slug: String(body.slug || `${body.n8n_item_id}-${Date.now()}`)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-"),
    excerpt: body.excerpt || null,
    content: String(body.content),
    image_url: body.image_url || null,
    image_credit: body.image_credit || null,
    source_name: body.source_name || null,
    source_url: body.source_url || null,
    author: body.author || "Redação",
    tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
    category_id: categoryId,
    n8n_item_id: String(body.n8n_item_id),
    editorial_status: "reescrita_ia",
    ai_status: "concluida",
    status: "review",
    published_at: body.published_at || null,
    updated_at: new Date().toISOString(),
  };
  // Older prototype databases may not have a UNIQUE constraint on n8n_item_id.
  // Resolve idempotency explicitly so inbound processing works on both schemas.
  const existing = await supabase
    .from("articles")
    .select("id")
    .eq("n8n_item_id", row.n8n_item_id)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (existing.error)
    return NextResponse.json(
      { error: existing.error.message },
      { status: 502 },
    );
  const existingArticle = existing.data?.[0] || null;

  let data: {
    id: string;
    n8n_item_id: string;
    editorial_status: string;
    wordpress_post_id?: number | null;
  } | null = null;
  let error: { message: string } | null = null;
  if (existingArticle?.id) {
    const result = await supabase
      .from("articles")
      .update(row)
      .eq("id", existingArticle.id)
      .select("id,n8n_item_id,editorial_status")
      .single();
    data = result.data;
    error = result.error;
  } else {
    const result = await supabase
      .from("articles")
      .insert(row)
      .select("id,n8n_item_id,editorial_status")
      .single();
    data = result.data;
    error = result.error;
  }
  if (error)
    return NextResponse.json({ error: error.message }, { status: 502 });

  // O recebimento da IA já cria o espelho como rascunho no WordPress. O ID
  // existente é reutilizado para que reentregas do n8n nunca criem duplicatas.
  const wpUser = process.env.WORDPRESS_USERNAME;
  const wpPassword = process.env.WORDPRESS_APPLICATION_PASSWORD;
  let wordpress: { id?: number; link?: string; status?: string } | null = null;
  let wordpressError = "";
  if (wpUser && wpPassword) {
    const auth = `Basic ${Buffer.from(`${wpUser}:${wpPassword}`).toString("base64")}`;
    const postId = existingArticle?.id
      ? (
          await supabase
            .from("articles")
            .select("wordpress_post_id")
            .eq("id", existingArticle.id)
            .maybeSingle()
        ).data?.wordpress_post_id
      : null;
    const endpoint = postId
      ? `${wpBase}/wp-json/wp/v2/posts/${postId}`
      : `${wpBase}/wp-json/wp/v2/posts`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: row.title,
        content: row.content,
        excerpt: row.excerpt || "",
        status: "draft",
        meta: {
          dfja_source_name: row.source_name || "",
          dfja_source_url: row.source_url || "",
          dfja_image_url: row.image_url || "",
          dfja_image_credit: row.image_credit || "",
          dfja_n8n_item_id: row.n8n_item_id,
        },
      }),
    });
    const responseText = await response.text();
    try {
      wordpress = responseText ? JSON.parse(responseText) : null;
    } catch {
      wordpress = null;
    }
    if (!response.ok)
      wordpressError = `WordPress rascunho falhou (${response.status}): ${responseText.slice(0, 300)}`;
    if (wordpress?.id && data?.id) {
      await supabase
        .from("articles")
        .update({
          wordpress_post_id: wordpress.id,
          wordpress_url: wordpress.link || null,
          status: "draft",
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id);
    }
  } else {
    wordpressError = "Credenciais do WordPress não configuradas no servidor.";
  }

  // O rascunho é criado nesta mesma entrada para que PWA e WordPress nasçam
  // juntos. Em seguida, informe o n8n com um evento determinístico; assim o
  // Workflow 05 atualiza a Fila sem criar duplicatas em reentregas.
  const resultWebhook = process.env.N8N_PWA_RESULT_WEBHOOK_URL;
  const resultSecret = process.env.N8N_PWA_RESULT_SECRET;
  if (resultWebhook && resultSecret) {
    const callbackStatus = wordpress?.id ? "rascunho_wp" : "erro_publicacao";
    const callback = {
      event_id: `inbound_draft_${row.n8n_item_id}_${wordpress?.id || "erro"}`,
      article_id: data?.id || "",
      n8n_item_id: row.n8n_item_id,
      approval_token: body.approval_token || "",
      wordpress_post_id: wordpress?.id || null,
      wordpress_url: wordpress?.link || null,
      status: callbackStatus,
      title: row.title,
      excerpt: row.excerpt,
      content: row.content,
      source_name: row.source_name,
      source_url: row.source_url,
      image_url: row.image_url,
      image_credit: row.image_credit,
      error: wordpressError || "",
    };
    fetch(resultWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-dfja-pwa-secret": resultSecret },
      body: JSON.stringify(callback),
    }).catch(() => {});
  }
  return NextResponse.json({
    ok: true,
    article: data,
    wordpress,
    wordpress_error: wordpressError || undefined,
  });
}
