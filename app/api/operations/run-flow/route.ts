import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const webhook = process.env.N8N_MANUAL_RUN_WEBHOOK_URL;
  const secret = process.env.N8N_MANUAL_RUN_SECRET;

  if (!webhook || !secret) {
    return NextResponse.json({ error: "Disparo manual ainda não foi configurado no servidor." }, { status: 503 });
  }

  let input: Record<string, unknown> = {};
  try {
    input = await request.json();
  } catch {
    // O corpo é opcional; o servidor fornece a origem e o horário.
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-dfja-manual-secret": secret,
    },
    body: JSON.stringify({ ...input, source: "pwa-operacao", requested_at: new Date().toISOString() }),
    cache: "no-store",
  });

  if (!response.ok) return NextResponse.json({ error: `Webhook do n8n respondeu ${response.status}.` }, { status: 502 });
  return NextResponse.json({ ok: true });
}
