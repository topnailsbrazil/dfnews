import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function clients(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authorization = request.headers.get("authorization") || "";
  if (!url || !anon || !service || !authorization) return null;
  const authClient = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(url, service);
  return { authClient, adminClient };
}

export async function POST(request: NextRequest) {
  const clientsForRequest = clients(request);
  if (!clientsForRequest)
    return NextResponse.json(
      { error: "Configuração editorial ausente." },
      { status: 503 },
    );
  const { authClient, adminClient } = clientsForRequest;
  const { data } = await authClient.auth.getUser();
  if (!data.user)
    return NextResponse.json(
      { error: "Sessão editorial inválida." },
      { status: 401 },
    );
  const { error } = await adminClient
    .from("articles")
    .delete()
    .not("id", "is", null);
  if (error)
    return NextResponse.json(
      { error: `Não foi possível limpar o painel: ${error.message}` },
      { status: 502 },
    );
  return NextResponse.json({
    ok: true,
    deleted: true,
    wordpress: "preservado",
  });
}
