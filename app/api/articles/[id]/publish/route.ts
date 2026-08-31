import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const wpBase = (process.env.WORDPRESS_URL || "https://dfja.com.br")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/wp-json(?:\/wp\/v2)?$/i, "");
const wpUser = process.env.WORDPRESS_USERNAME;
const wpPassword = process.env.WORDPRESS_APPLICATION_PASSWORD;

function describeWordPressError(label: string, response: Response) {
  return response.text().then((body) => {
    const compact = body.replace(/\s+/g, " ").trim().slice(0, 240);
    return `${label} (${response.status}) em ${response.url}${compact ? `: ${compact}` : ""}`;
  });
}

function supabaseFor(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization") || "";
  if (!url || !key || !authorization) return null;
  return createClient(url, key, {
    global: { headers: { Authorization: authorization } },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!wpUser || !wpPassword)
    return NextResponse.json(
      {
        error:
          "Configure WORDPRESS_USERNAME e WORDPRESS_APPLICATION_PASSWORD no servidor.",
      },
      { status: 503 },
    );
  const supabase = supabaseFor(request);
  if (!supabase)
    return NextResponse.json(
      { error: "Sessão editorial ausente." },
      { status: 401 },
    );
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user)
    return NextResponse.json(
      { error: "Sessão editorial inválida." },
      { status: 401 },
    );

  const requestBody = await request.json().catch(() => ({}));
  const wpStatus = requestBody.status === "draft" ? "draft" : "publish";
  const { data: article, error } = await supabase
    .from("articles")
    .select("*")
    .eq("id", params.id)
    .single();
  if (error || !article)
    return NextResponse.json(
      { error: "Matéria não encontrada." },
      { status: 404 },
    );
  const submitted = [
    "title",
    "content",
    "excerpt",
    "image_url",
    "image_credit",
    "source_name",
    "source_url",
    "category_id",
    "author",
    "tags",
  ].reduce<Record<string, unknown>>((out, key) => {
    if (requestBody[key] !== undefined) out[key] = requestBody[key];
    return out;
  }, {});
  const currentArticle = { ...article, ...submitted };
  let effectiveVersion = Number(article.version || 1);
  if (
    !String(currentArticle.title || "").trim() ||
    !String(currentArticle.content || "").trim()
  )
    return NextResponse.json(
      {
        error: "Preencha título e texto completo antes de enviar ao WordPress.",
      },
      { status: 400 },
    );
  if (Object.keys(submitted).length) {
    effectiveVersion += 1;
    const saved = await supabase
      .from("articles")
      .update({
        ...submitted,
        updated_at: new Date().toISOString(),
        version: effectiveVersion,
      })
      .eq("id", article.id)
      .eq("version", Number(article.version || 1))
      .select("id")
      .single();
    if (saved.error || !saved.data)
      return NextResponse.json(
        {
          error:
            "A matéria foi alterada por outro editor. Atualize a página antes de publicar.",
        },
        { status: 409 },
      );
  }
  if (article.wordpress_post_id && article.editorial_status === "publicada")
    return NextResponse.json({
      ok: true,
      id: article.wordpress_post_id,
      url: article.wordpress_url,
      idempotent: true,
    });
  if (!currentArticle.image_url && !currentArticle.wordpress_media_id)
    return NextResponse.json(
      {
        error:
          "A matéria precisa de uma imagem de destaque antes da publicação.",
      },
      { status: 400 },
    );

  const auth = `Basic ${Buffer.from(`${wpUser}:${wpPassword}`).toString("base64")}`;
  let mediaId = currentArticle.wordpress_media_id || 0;
  try {
    if (!mediaId && currentArticle.image_url) {
      const imageResponse = await fetch(String(currentArticle.image_url));
      if (!imageResponse.ok)
        throw new Error(`imagem indisponível (${imageResponse.status})`);
      const imageBuffer = await imageResponse.arrayBuffer();
      const contentType =
        imageResponse.headers.get("content-type") || "image/jpeg";
      const mediaResponse = await fetch(`${wpBase}/wp-json/wp/v2/media`, {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Disposition": `attachment; filename=dfja-${article.id}.jpg`,
          "Content-Type": contentType,
        },
        body: imageBuffer,
      });
      if (!mediaResponse.ok)
        throw new Error(
          await describeWordPressError(
            "upload da imagem falhou",
            mediaResponse,
          ),
        );
      mediaId = Number((await mediaResponse.json()).id);
    }
    let categoryIds: number[] | undefined;
    const requestedCategoryIds = Array.isArray(requestBody.category_ids)
      ? requestBody.category_ids.filter((id: unknown) => typeof id === "string")
      : currentArticle.category_id
        ? [currentArticle.category_id]
        : [];
    if (requestedCategoryIds.length) {
      const { data: categories } = await supabase
        .from("categories")
        .select("name")
        .in("id", requestedCategoryIds);
      const wpCategoryIds: number[] = [];
      for (const category of categories || []) {
        if (!category.name) continue;
        const categoryResponse = await fetch(
          `${wpBase}/wp-json/wp/v2/categories?search=${encodeURIComponent(category.name)}&per_page=20`,
          { headers: { Authorization: auth } },
        );
        if (!categoryResponse.ok) continue;
        const matches = await categoryResponse.json();
        const exact = matches.find(
          (item: { name?: string }) =>
            item.name?.toLowerCase() === category.name.toLowerCase(),
        );
        if (exact?.id) wpCategoryIds.push(Number(exact.id));
      }
      if (wpCategoryIds.length) {
        categoryIds = Array.from(new Set(wpCategoryIds));
      }
    }
    // O WordPress REST aceita apenas IDs inteiros no campo `tags`.
    // O PWA pode guardar palavras-chave textuais (ex.: "df"), então
    // descartamos somente os valores que não são IDs válidos no envio.
    const wpTagIds = Array.isArray(currentArticle.tags)
      ? currentArticle.tags
          .map((tag: unknown) => Number(tag))
          .filter((tag: number) => Number.isInteger(tag) && tag > 0)
      : [];

    const payload = {
      title: currentArticle.title,
      content: currentArticle.content,
      excerpt: currentArticle.excerpt || "",
      status: wpStatus,
      categories: categoryIds,
      tags: wpTagIds.length ? wpTagIds : undefined,
      featured_media: mediaId || undefined,
      meta: {
        dfja_source_name: currentArticle.source_name || "",
        dfja_source_url: currentArticle.source_url || "",
        dfja_image_url: currentArticle.image_url || "",
        dfja_image_credit: currentArticle.image_credit || "",
        dfja_n8n_item_id: article.n8n_item_id || "",
      },
    };
    let endpoint = article.wordpress_post_id
      ? `${wpBase}/wp-json/wp/v2/posts/${article.wordpress_post_id}`
      : `${wpBase}/wp-json/wp/v2/posts`;
    let response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    // An old/stale post id must not permanently block publication. Recreate it once.
    if (!response.ok && article.wordpress_post_id && response.status === 404) {
      endpoint = `${wpBase}/wp-json/wp/v2/posts`;
      response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    if (!response.ok)
      throw new Error(
        await describeWordPressError("publicação WordPress falhou", response),
      );
    const post = await response.json();
    const now = new Date().toISOString();
    const editorialStatus =
      wpStatus === "draft" ? "pronta_para_publicacao" : "publicada";
    const editorialUpdate = await supabase
      .from("articles")
      .update({
        wordpress_post_id: post.id,
        wordpress_media_id: mediaId || null,
        wordpress_url: post.link,
        editorial_status: editorialStatus,
        status: wpStatus === "draft" ? "draft" : "published",
        published_at: wpStatus === "draft" ? null : now,
        updated_at: now,
        last_error: null,
        version: effectiveVersion + 1,
      })
      .eq("id", article.id)
      .eq("version", effectiveVersion);
    if (editorialUpdate.error)
      throw new Error(
        `WordPress publicou, mas o vínculo editorial não foi salvo: ${editorialUpdate.error.message}`,
      );
    const resultWebhook = process.env.N8N_PWA_RESULT_WEBHOOK_URL;
    if (resultWebhook)
      fetch(resultWebhook, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dfja-pwa-secret": process.env.N8N_PWA_RESULT_SECRET || "",
        },
        body: JSON.stringify({
          event_id: `publish_${article.id}_${post.id}_${Date.now()}`,
          article_id: article.id,
          n8n_item_id: article.n8n_item_id,
          wordpress_post_id: post.id,
          wordpress_media_id: mediaId || null,
          wordpress_url: post.link,
          status: wpStatus === "draft" ? "rascunho_wp" : "publicada",
          published_at: wpStatus === "draft" ? null : now,
          title: article.title,
          excerpt: article.excerpt,
          content: article.content,
          category_id: article.category_id,
          author: article.author,
          tags: article.tags || [],
          image_url: article.image_url,
          image_credit: article.image_credit,
          source_name: article.source_name,
          source_url: article.source_url,
        }),
      }).catch(() => {});
    return NextResponse.json({
      ok: true,
      id: post.id,
      mediaId,
      url: post.link,
      status: wpStatus,
    });
  } catch (publishError) {
    const message =
      publishError instanceof Error
        ? publishError.message
        : "Falha desconhecida";
    await supabase
      .from("articles")
      .update({
        editorial_status: "erro_publicacao",
        last_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", article.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
