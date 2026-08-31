import { NextRequest, NextResponse } from "next/server";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl) return NextResponse.json({ error: "URL da imagem ausente." }, { status: 400 });

  let source: URL;
  try {
    source = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "URL da imagem inválida." }, { status: 400 });
  }
  if (!['http:', 'https:'].includes(source.protocol)) {
    return NextResponse.json({ error: "A imagem precisa usar HTTP ou HTTPS." }, { status: 400 });
  }

  const response = await fetch(source, { redirect: "follow", cache: "no-store" });
  if (!response.ok) return NextResponse.json({ error: `Não foi possível ler a imagem (${response.status}).` }, { status: 502 });

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "A URL não aponta para uma imagem." }, { status: 415 });
  }
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_IMAGE_BYTES) return NextResponse.json({ error: "A imagem deve ter no máximo 8 MB." }, { status: 413 });

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_IMAGE_BYTES) return NextResponse.json({ error: "A imagem deve ter no máximo 8 MB." }, { status: 413 });
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300",
    },
  });
}
