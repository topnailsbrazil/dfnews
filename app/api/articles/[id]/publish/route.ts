import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const wpBase = process.env.WORDPRESS_URL || "https://dfja.com.br";
const wpUser = process.env.WORDPRESS_USERNAME;
const wpPassword = process.env.WORDPRESS_APPLICATION_PASSWORD;

function supabaseFor(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization") || "";
  if (!url || !key || !authorization) return null;
  return createClient(url, key, { global: { headers: { Authorization: authorization } } });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!wpUser || !wpPassword) return NextResponse.json({ error: "Configure WORDPRESS_USERNAME e WORDPRESS_APPLICATION_PASSWORD no servidor." }, { status: 503 });
  const supabase = supabaseFor(request);
  if (!supabase) return NextResponse.json({ error: "Sessão editorial ausente." }, { status: 401 });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Sessão editorial inválida." }, { status: 401 });

  const requestBody = await request.json().catch(() => ({}));
  const wpStatus = requestBody.status === "draft" ? "draft" : "publish";
  const { data: article, error } = await supabase.from("articles").select("*").eq("id", params.id).single();
  if (error || !article) return NextResponse.json({ error: "Matéria não encontrada." }, { status: 404 });
  if (article.wordpress_post_id && article.editorial_status === "publicada") return NextResponse.json({ ok: true, id: article.wordpress_post_id, url: article.wordpress_url, idempotent: true });

  const auth = `Basic ${Buffer.from(`${wpUser}:${wpPassword}`).toString("base64")}`;
  let mediaId = article.wordpress_media_id || 0;
  try {
    if (!mediaId && article.image_url) {
      const imageResponse = await fetch(article.image_url);
      if (!imageResponse.ok) throw new Error(`imagem indisponível (${imageResponse.status})`);
      const imageBuffer = await imageResponse.arrayBuffer();
      const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
      const mediaResponse = await fetch(`${wpBase}/wp-json/wp/v2/media`, { method: "POST", headers: { Authorization: auth, "Content-Disposition": `attachment; filename=dfja-${article.id}.jpg`, "Content-Type": contentType }, body: imageBuffer });
      if (!mediaResponse.ok) throw new Error(`upload da imagem falhou (${mediaResponse.status})`);
      mediaId = Number((await mediaResponse.json()).id);
    }
    let categoryIds: number[] | undefined;
    if (article.category_id) {
      const { data: category } = await supabase.from("categories").select("name").eq("id", article.category_id).single();
      if (category?.name) {
        const categoryResponse = await fetch(`${wpBase}/wp-json/wp/v2/categories?search=${encodeURIComponent(category.name)}&per_page=20`, { headers: { Authorization: auth } });
        if (categoryResponse.ok) {
          const matches = await categoryResponse.json();
          const exact = matches.find((item: { name?: string }) => item.name?.toLowerCase() === category.name.toLowerCase());
          if (exact?.id) categoryIds = [Number(exact.id)];
        }
      }
    }
    const payload = { title: article.title, content: article.content, excerpt: article.excerpt || "", status: wpStatus, categories: categoryIds, tags: Array.isArray(article.tags) ? article.tags : undefined, featured_media: mediaId || undefined, meta: { dfja_source_name: article.source_name || "", dfja_source_url: article.source_url || "", dfja_image_url: article.image_url || "", dfja_image_credit: article.image_credit || "", dfja_n8n_item_id: article.n8n_item_id || "" } };
    const endpoint = article.wordpress_post_id ? `${wpBase}/wp-json/wp/v2/posts/${article.wordpress_post_id}` : `${wpBase}/wp-json/wp/v2/posts`;
    const response = await fetch(endpoint, { method: article.wordpress_post_id ? "POST" : "POST", headers: { Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(`publicação WordPress falhou (${response.status})`);
    const post = await response.json();
    const now = new Date().toISOString();
    const editorialStatus = wpStatus === "draft" ? "pronta_para_publicacao" : "publicada";
    await supabase.from("articles").update({ wordpress_post_id: post.id, wordpress_media_id: mediaId || null, wordpress_url: post.link, editorial_status: editorialStatus, status: wpStatus === "draft" ? "draft" : "published", published_at: wpStatus === "draft" ? null : now, updated_at: now, last_error: null, version: Number(article.version || 1) + 1 }).eq("id", article.id).eq("version", article.version);
    const resultWebhook = process.env.N8N_PWA_RESULT_WEBHOOK_URL;
    if (resultWebhook) fetch(resultWebhook, { method: "POST", headers: { "Content-Type": "application/json", "x-dfja-pwa-secret": process.env.N8N_PWA_RESULT_SECRET || "" }, body: JSON.stringify({ article_id: article.id, n8n_item_id: article.n8n_item_id, wordpress_post_id: post.id, wordpress_media_id: mediaId || null, wordpress_url: post.link, status: "publicada", published_at: now }) }).catch(() => {});
    return NextResponse.json({ ok: true, id: post.id, mediaId, url: post.link, status: wpStatus });
  } catch (publishError) {
    const message = publishError instanceof Error ? publishError.message : "Falha desconhecida";
    await supabase.from("articles").update({ editorial_status: "erro_publicacao", last_error: message, updated_at: new Date().toISOString() }).eq("id", article.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
