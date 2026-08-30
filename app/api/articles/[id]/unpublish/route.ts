import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const wpBase = (process.env.WORDPRESS_URL || "https://dfja.com.br")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/wp-json(?:\/wp\/v2)?$/i, "");
const wpUser = process.env.WORDPRESS_USERNAME;
const wpPassword = process.env.WORDPRESS_APPLICATION_PASSWORD;

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
      { error: "Credenciais do WordPress não configuradas no servidor." },
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
  if (!article.wordpress_post_id)
    return NextResponse.json(
      { error: "Esta matéria não possui post WordPress vinculado." },
      { status: 409 },
    );

  const expectedVersion = Number(article.version || 1);
  const lock = await supabase
    .from("articles")
    .update({
      locked_by: userData.user.id,
      locked_at: new Date().toISOString(),
    })
    .eq("id", article.id)
    .eq("version", expectedVersion)
    .select("id")
    .single();
  if (lock.error || !lock.data)
    return NextResponse.json(
      {
        error:
          "A matéria foi alterada por outro editor. Recarregue e tente novamente.",
      },
      { status: 409 },
    );

  const auth = `Basic ${Buffer.from(`${wpUser}:${wpPassword}`).toString("base64")}`;
  try {
    const response = await fetch(
      `${wpBase}/wp-json/wp/v2/posts/${article.wordpress_post_id}`,
      {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft" }),
      },
    );
    const responseText = await response.text();
    let post: { id?: number; link?: string; status?: string } = {};
    try {
      post = responseText ? JSON.parse(responseText) : {};
    } catch {
      post = {};
    }
    if (!response.ok)
      throw new Error(
        `Despublicação WordPress falhou (${response.status}): ${
          post && typeof post === "object" && "message" in post
            ? String((post as { message?: unknown }).message)
            : responseText.slice(0, 300)
        }`,
      );

    // Só confirmamos a operação depois de verificar o estado real do post.
    const verification = await fetch(
      `${wpBase}/wp-json/wp/v2/posts/${article.wordpress_post_id}?context=edit`,
      { headers: { Authorization: auth } },
    );
    const verificationText = await verification.text();
    let verifiedPost: { status?: string; link?: string } = {};
    try {
      verifiedPost = verificationText ? JSON.parse(verificationText) : {};
    } catch {
      verifiedPost = {};
    }
    if (!verification.ok || verifiedPost.status !== "draft")
      throw new Error(
        `WordPress não confirmou a despublicação (status retornado: ${
          verifiedPost.status || `HTTP ${verification.status}`
        }).`,
      );

    // O feed público usa a API sem autenticação. Confirme também por esse
    // caminho; se alguma configuração do WordPress ainda expuser o rascunho,
    // torne-o privado para garantir que não permaneça no site.
    const publicCheck = await fetch(
      `${wpBase}/wp-json/wp/v2/posts/${article.wordpress_post_id}?_fields=id,status`,
      { cache: "no-store" },
    );
    if (publicCheck.ok) {
      const publicPost = (await publicCheck.json()) as { status?: string };
      if (publicPost.status === "publish") {
        const privateResponse = await fetch(
          `${wpBase}/wp-json/wp/v2/posts/${article.wordpress_post_id}`,
          {
            method: "POST",
            headers: {
              Authorization: auth,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ status: "private" }),
          },
        );
        if (!privateResponse.ok)
          throw new Error(
            `O WordPress ainda expôs a matéria e não permitiu ocultá-la (${privateResponse.status}).`,
          );
      }
    }
    const now = new Date().toISOString();
    const updated = await supabase
      .from("articles")
      .update({
        editorial_status: "devolvida_para_revisao",
        status: "draft",
        published_at: null,
        updated_at: now,
        last_error: null,
        locked_by: null,
        locked_at: null,
        version: expectedVersion + 1,
      })
      .eq("id", article.id)
      .eq("version", expectedVersion)
      .select("id")
      .single();
    if (updated.error || !updated.data)
      throw new Error(
        "O post foi despublicado, mas a atualização editorial encontrou conflito de versão.",
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
          event_id: `unpublish_${article.id}_${article.wordpress_post_id}_${Date.now()}`,
          article_id: article.id,
          n8n_item_id: article.n8n_item_id,
          wordpress_post_id: article.wordpress_post_id,
          wordpress_url: post.link || article.wordpress_url,
          status: "devolvida_para_revisao",
          title: article.title,
          timestamp: now,
        }),
      }).catch(() => {});
    return NextResponse.json({
      ok: true,
      id: post.id,
      url: post.link || article.wordpress_url,
      status: "draft",
    });
  } catch (unpublishError) {
    const message =
      unpublishError instanceof Error
        ? unpublishError.message
        : "Falha desconhecida";
    await supabase
      .from("articles")
      .update({
        last_error: message,
        locked_by: null,
        locked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", article.id)
      .eq("version", expectedVersion);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
