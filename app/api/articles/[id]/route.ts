import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authorization = request.headers.get("authorization") || "";
  if (!url || !anon || !service || !authorization)
    return NextResponse.json(
      { error: "Configuração editorial ausente." },
      { status: 503 },
    );

  const authClient = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(url, service);
  const { data } = await authClient.auth.getUser();
  if (!data.user)
    return NextResponse.json(
      { error: "Sessão editorial inválida." },
      { status: 401 },
    );

  const { data: article, error: findError } = await adminClient
    .from("articles")
    .select("id, title, wordpress_post_id")
    .eq("id", params.id)
    .maybeSingle();
  if (findError)
    return NextResponse.json({ error: findError.message }, { status: 502 });
  if (!article)
    return NextResponse.json(
      { error: "Matéria não encontrada." },
      { status: 404 },
    );

  const { error } = await adminClient
    .from("articles")
    .delete()
    .eq("id", params.id);
  if (error)
    return NextResponse.json(
      { error: `Não foi possível excluir: ${error.message}` },
      { status: 502 },
    );
  return NextResponse.json({
    ok: true,
    deleted: params.id,
    wordpress: "preservado",
  });
}
