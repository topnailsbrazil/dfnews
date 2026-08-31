"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Category = { id: string; name: string };
type EditorialStatus =
  | "coletada"
  | "enviada_whatsapp"
  | "aprovada_para_ia"
  | "reescrita_ia"
  | "em_revisao_pwa"
  | "pronta_para_publicacao"
  | "publicada"
  | "rejeitada"
  | "devolvida_para_revisao"
  | "erro_publicacao";
type Article = {
  id: string;
  title: string;
  excerpt: string | null;
  content: string;
  image_url: string | null;
  cover_image_url?: string | null;
  image_credit: string | null;
  source_name: string | null;
  source_url: string | null;
  category_id: string | null;
  author: string | null;
  tags: string[] | null;
  editorial_status: EditorialStatus;
  wordpress_url: string | null;
  wordpress_post_id?: number | null;
  wordpress_media_id?: number | null;
  cover_media_id?: number | null;
  last_error: string | null;
  version: number;
  updated_at: string;
  status?: string | null;
  published_at?: string | null;
  created_at?: string | null;
};
const labels: Record<EditorialStatus, string> = {
  coletada: "Coletada",
  enviada_whatsapp: "Enviada ao WhatsApp",
  aprovada_para_ia: "Aprovada para IA",
  reescrita_ia: "Reescrita pela IA",
  em_revisao_pwa: "Em revisão",
  pronta_para_publicacao: "Pronta para publicar",
  publicada: "Publicada",
  rejeitada: "Rejeitada",
  devolvida_para_revisao: "Devolvida",
  erro_publicacao: "Erro de publicação",
};
const viewLabels = {
  all: "Fila",
  new: "Novas",
  review: "Em revisão",
  published: "Publicadas",
} as const;
const fields =
  "id,title,excerpt,content,image_url,cover_image_url,image_credit,source_name,source_url,category_id,author,tags,editorial_status,wordpress_url,wordpress_post_id,wordpress_media_id,cover_media_id,last_error,version,updated_at,status,published_at,created_at";
const FEED_URL = "https://dfja.com.br";
const CATEGORY_TAG_PREFIX = "__dfja_category:";

function categoryIds(article: Article | null) {
  if (!article) return [];
  return Array.from(
    new Set([
      ...(article.category_id ? [article.category_id] : []),
      ...(article.tags || [])
        .filter((tag) => tag.startsWith(CATEGORY_TAG_PREFIX))
        .map((tag) => tag.slice(CATEGORY_TAG_PREFIX.length))
        .filter(Boolean),
    ]),
  );
}

function visibleTags(tags: string[] | null | undefined) {
  return (tags || []).filter((tag) => !tag.startsWith(CATEGORY_TAG_PREFIX));
}
function displayImage(article: Article) {
  return article.cover_image_url || article.image_url;
}

function isPublished(article: Article) {
  return article.status === "published" || article.editorial_status === "publicada";
}

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminPanel() {
  const [session, setSession] = useState<{
    access_token: string;
    user_id: string;
  } | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [publishedArticles, setPublishedArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [draft, setDraft] = useState<Article | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [runningFlow, setRunningFlow] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [coverTitle, setCoverTitle] = useState("");
  const [coverSubtitle, setCoverSubtitle] = useState("");
  const [coverGradient, setCoverGradient] = useState(62);
  const [coverPosition, setCoverPosition] = useState("bottom");
  const [coverTemplate, setCoverTemplate] = useState("jornal");
  const [coverAccent, setCoverAccent] = useState("#147d6e");
  const [coverLogoText, setCoverLogoText] = useState("DFJÁ");
  const [coverSecondImageUrl, setCoverSecondImageUrl] = useState("");
  const [coverLogoFile, setCoverLogoFile] = useState<File | null>(null);
  const [view, setView] = useState<"all" | "new" | "review" | "published">("all");
  useEffect(() => {
    supabase.auth.getSession().then(
      ({ data }) =>
        data.session &&
        setSession({
          access_token: data.session.access_token,
          user_id: data.session.user.id,
        }),
    );
    const listener = supabase.auth.onAuthStateChange((_event, next) =>
      setSession(
        next
          ? { access_token: next.access_token, user_id: next.user.id }
          : null,
      ),
    );
    return () => listener.data.subscription.unsubscribe();
  }, []);
  async function load(showFeedback = false) {
    if (showFeedback) {
      setRefreshing(true);
      setMessage("Atualizando a fila…");
    }
    try {
      const [a, c, p] = await Promise.all([
        supabase
          .from("articles")
          .select(fields)
          .not("editorial_status", "eq", "rejeitada")
          .order("updated_at", { ascending: false })
          .limit(200),
        fetch("/api/categories").then(async (r) => (r.ok ? r.json() : [])),
        supabase
          .from("articles")
          .select(fields)
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(60),
      ]);
      if (a.error) throw new Error(a.error.message);
      setArticles((a.data || []) as Article[]);
      if (p.error) throw new Error(p.error.message);
      setPublishedArticles((p.data || []) as Article[]);
      setCategories(Array.isArray(c) ? c : []);
      if (showFeedback) setMessage("Fila atualizada.");
    } catch (error) {
      setMessage(`Não foi possível atualizar a fila: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    } finally {
      if (showFeedback) setRefreshing(false);
    }
  }
  async function runFlow() {
    if (runningFlow) return;
    setRunningFlow(true);
    setMessage("Disparando a busca de novas matérias…");
    try {
      const response = await fetch("/api/operations/run-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "pwa-editorial" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `O n8n respondeu ${response.status}.`);
      setMessage("Busca disparada. A fila será atualizada em alguns segundos.");
      window.setTimeout(() => load(), 1800);
    } catch (error) {
      setMessage(`Não foi possível iniciar a busca: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    } finally {
      setRunningFlow(false);
    }
  }
  useEffect(() => {
    if (session) load();
  }, [session]);
  useEffect(() => {
    if (draft) {
      setCoverTitle(draft.title || "DFJÁ");
      setCoverSubtitle(draft.excerpt || "");
    }
  }, [draft?.id]);
  const filtered = useMemo(() => {
    const source = view === "published" ? publishedArticles : articles;
    return source.filter((a) => {
      const matchesQuery = `${a.title} ${a.source_name || ""} ${a.id} ${a.editorial_status}`
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesView =
        view === "all" ||
        (view === "published" && isPublished(a)) ||
        (view === "new" && ["coletada", "enviada_whatsapp", "aprovada_para_ia"].includes(a.editorial_status)) ||
        (view === "review" && !isPublished(a) && !["coletada", "enviada_whatsapp", "aprovada_para_ia"].includes(a.editorial_status));
      return matchesQuery && matchesView;
    });
  }, [articles, publishedArticles, query, view]);
  const counts = useMemo(
    () => ({
      all: articles.length,
      new: articles.filter((a) => ["coletada", "enviada_whatsapp", "aprovada_para_ia"].includes(a.editorial_status)).length,
      review: articles.filter((a) => !isPublished(a) && !["coletada", "enviada_whatsapp", "aprovada_para_ia"].includes(a.editorial_status)).length,
      published: publishedArticles.length,
    }),
    [articles, publishedArticles],
  );
  async function select(article: Article) {
    const claim = await supabase.rpc("claim_article", {
      p_article_id: article.id,
    });
    if (claim.error || claim.data !== true) {
      setMessage("Esta matéria está sendo editada por outro aprovador.");
      return;
    }
    const next = ["coletada", "enviada_whatsapp", "reescrita_ia"].includes(
      article.editorial_status,
    )
      ? "em_revisao_pwa"
      : article.editorial_status;
    setDraft({ ...article, editorial_status: next });
    setMessage("Matéria reservada para esta sessão.");
  }
  function update(field: keyof Article, value: string | string[]) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  }
  function updateCategories(ids: string[]) {
    if (!draft) return;
    const nextIds = Array.from(new Set(ids));
    const tags = visibleTags(draft.tags);
    setDraft({
      ...draft,
      category_id: nextIds[0] || null,
      tags: [...nextIds.map((id) => `${CATEGORY_TAG_PREFIX}${id}`), ...tags],
    });
  }
  useEffect(() => {
    if (!draft || !session) return;
    const timer = window.setTimeout(async () => {
      setSaving(true);
      const snapshot = { ...draft };
      const update = {
        title: draft.title,
        excerpt: draft.excerpt,
        content: draft.content,
        image_url: draft.image_url,
        image_credit: draft.image_credit,
        source_name: draft.source_name,
        source_url: draft.source_url,
        category_id: draft.category_id,
        author: draft.author,
        tags: draft.tags || [],
        editorial_status: draft.editorial_status,
        updated_at: new Date().toISOString(),
        version: draft.version + 1,
      };
      const result = await supabase
        .from("articles")
        .update(update)
        .eq("id", draft.id)
        .eq("version", draft.version)
        .select(fields)
        .maybeSingle();
      if (result.error || !result.data)
        setMessage(
          result.error
            ? `Autosave falhou: ${result.error.message}`
            : "Autosave não aplicou a alteração porque a matéria mudou. Clique em Atualizar e abra-a novamente.",
        );
      else {
        await supabase.from("article_revisions").insert({
          article_id: draft.id,
          changed_by: session.user_id,
          snapshot,
        });
        setDraft(result.data as Article);
        fetch(`/api/articles/${draft.id}/sync`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).catch(() => {});
      }
      setSaving(false);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [
    draft?.title,
    draft?.excerpt,
    draft?.content,
    draft?.image_url,
    draft?.image_credit,
    draft?.source_name,
    draft?.source_url,
    draft?.category_id,
    draft?.author,
    draft?.tags?.join("|"),
    draft?.editorial_status,
  ]);
  async function login(event: FormEvent) {
    event.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setMessage(error.message);
  }
  async function newArticle() {
    if (!session) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const article = {
      id,
      title: "",
      excerpt: "",
      content: "",
      image_url: null,
      image_credit: "",
      source_name: "DFJÁ",
      source_url: "",
      category_id: null,
      author: "Redação",
      tags: [],
      editorial_status: "em_revisao_pwa" as EditorialStatus,
      status: "draft",
      slug: `materia-${id}`,
      version: 1,
      updated_at: now,
    };
    const result = await supabase
      .from("articles")
      .insert(article)
      .select(fields)
      .single();
    if (result.error || !result.data) {
      setMessage(
        `Não foi possível criar a matéria: ${result.error?.message || "erro desconhecido"}`,
      );
      return;
    }
    setArticles((current) => [result.data as Article, ...current]);
    setDraft(result.data as Article);
    setMessage("Nova matéria criada. Preencha os campos e salve ou publique.");
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !draft || !session) return;
    setSaving(true);
    setMessage("Enviando imagem para a biblioteca do WordPress…");
    const body = new FormData();
    body.append("file", file);
    const result = await fetch(`/api/articles/${draft.id}/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
      body,
    });
    const data = await result.json().catch(() => ({}));
    if (!result.ok) setMessage(data.error || "Falha ao enviar a imagem.");
    else {
      update("image_url", data.url || "");
      setMessage("Imagem vinculada como destaque do WordPress.");
    }
    setSaving(false);
  }
  async function createCover() {
    if (!draft || !session || !draft.image_url) {
      setMessage("Adicione uma imagem antes de criar a capa.");
      return;
    }
    setSaving(true);
    setMessage("Gerando a capa editorial…");
    try {
      const loadImage = async (url: string) => {
        const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`);
        if (!response.ok) throw new Error("Não foi possível carregar a imagem da capa.");
        const objectUrl = URL.createObjectURL(await response.blob());
        const loaded = new Image();
        loaded.src = objectUrl;
        await new Promise<void>((resolve, reject) => {
          loaded.onload = () => resolve();
          loaded.onerror = () => reject(new Error("Não foi possível decodificar a imagem."));
        });
        return { image: loaded, objectUrl };
      };
      const primary = await loadImage(draft.image_url);
      const secondary = coverSecondImageUrl.trim() ? await loadImage(coverSecondImageUrl.trim()) : null;
      const logoUrl = coverLogoFile ? URL.createObjectURL(coverLogoFile) : null;
      const logo = logoUrl ? new Image() : null;
      if (logo && logoUrl) {
        logo.src = logoUrl;
        await new Promise<void>((resolve, reject) => {
          logo.onload = () => resolve();
          logo.onerror = () => reject(new Error("Não foi possível carregar o logo."));
        });
      }
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 1500;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Editor de capa indisponível.");
      const drawCoverImage = (image: HTMLImageElement, x: number, y: number, width: number, height: number) => {
        const scale = Math.max(width / image.width, height / image.height);
        const drawnWidth = image.width * scale;
        const drawnHeight = image.height * scale;
        context.drawImage(image, x + (width - drawnWidth) / 2, y + (height - drawnHeight) / 2, drawnWidth, drawnHeight);
      };
      context.fillStyle = coverTemplate === "faixa" ? "#050505" : coverAccent;
      context.fillRect(0, 0, canvas.width, canvas.height);
      if (coverTemplate === "dividida" && secondary) {
        drawCoverImage(primary.image, 0, 0, canvas.width / 2, canvas.height * 0.62);
        drawCoverImage(secondary.image, canvas.width / 2, 0, canvas.width / 2, canvas.height * 0.62);
        context.fillStyle = "#050505";
        context.fillRect(0, canvas.height * 0.62, canvas.width, canvas.height * 0.38);
      } else if (coverTemplate === "faixa") {
        drawCoverImage(primary.image, 0, 0, canvas.width, canvas.height * 0.64);
        context.fillStyle = "#050505";
        context.fillRect(0, canvas.height * 0.58, canvas.width, canvas.height * 0.42);
      } else {
        drawCoverImage(primary.image, 0, 0, canvas.width, canvas.height);
      }
      const opacity = Math.max(0, Math.min(100, coverGradient)) / 100;
      const gradient = context.createLinearGradient(0, coverPosition === "top" ? 0 : canvas.height, 0, coverPosition === "top" ? canvas.height : 0);
      gradient.addColorStop(0, `rgba(3, 8, 16, ${opacity})`);
      gradient.addColorStop(0.62, `rgba(3, 8, 16, ${opacity * 0.42})`);
      gradient.addColorStop(1, "rgba(3, 8, 16, 0.04)");
      if (coverTemplate !== "faixa") { context.fillStyle = gradient; context.fillRect(0, 0, canvas.width, canvas.height); }
      if (logo) {
        const logoHeight = 70;
        const logoWidth = Math.min(300, logo.width * logoHeight / logo.height);
        context.drawImage(logo, 54, 48, logoWidth, logoHeight);
      } else if (coverLogoText.trim()) {
        context.fillStyle = coverAccent;
        context.fillRect(48, 44, 190, 70);
        context.fillStyle = "#fff";
        context.font = "800 38px Arial, sans-serif";
        context.textBaseline = "middle";
        context.fillText(coverLogoText.trim().slice(0, 18), 66, 80);
      }
      const bottom = coverPosition === "top" ? 160 : canvas.height - (coverTemplate === "dividida" || coverTemplate === "faixa" ? 90 : 110);
      context.fillStyle = "#ffffff";
      context.font = coverTemplate === "dividida" ? "800 48px Georgia, serif" : "800 54px Arial, sans-serif";
      context.textBaseline = coverPosition === "top" ? "top" : "bottom";
      const wrap = (text: string, maxWidth: number) => {
        const words = text.trim().split(/\s+/).filter(Boolean);
        const lines: string[] = [];
        let line = "";
        words.forEach((word) => {
          const next = line ? `${line} ${word}` : word;
          if (context.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next;
        });
        if (line) lines.push(line);
        return lines.slice(0, 4);
      };
      const titleLines = wrap(coverTitle || draft.title || "DFJÁ", canvas.width - 120);
      titleLines.forEach((line, index) => context.fillText(line, 60, coverPosition === "top" ? bottom + index * 56 : bottom - (titleLines.length - 1 - index) * 56));
      if (coverSubtitle.trim()) {
        context.font = "500 25px Arial, sans-serif";
        context.fillStyle = "rgba(255,255,255,.88)";
        const subtitleY = coverPosition === "top" ? bottom + titleLines.length * 56 + 28 : bottom + 30;
        context.fillText(coverSubtitle.trim().slice(0, 110), 60, subtitleY);
      }
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("Não foi possível exportar a capa.");
      const body = new FormData();
      body.append("file", blob, `capa-${draft.id}.jpg`);
      body.append("kind", "cover");
      const result = await fetch(`/api/articles/${draft.id}/image`, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body });
      const data = await result.json().catch(() => ({}));
      if (!result.ok || !data.url) throw new Error(data.error || "Falha ao salvar a capa.");
      setDraft((current) => current ? { ...current, cover_image_url: data.url, cover_media_id: data.mediaId || current.cover_media_id } : current);
      setMessage("Capa criada e vinculada à matéria.");
      URL.revokeObjectURL(primary.objectUrl);
      if (secondary) URL.revokeObjectURL(secondary.objectUrl);
      if (logoUrl) URL.revokeObjectURL(logoUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível criar a capa.");
    } finally {
      setSaving(false);
    }
  }
  async function publish(status: "publish" | "draft") {
    if (
      !draft ||
      !session ||
      !window.confirm(
        status === "draft"
          ? "Enviar esta matéria como rascunho ao WordPress?"
          : "Publicar esta matéria diretamente no WordPress?",
      )
    )
      return;
    setPublishing(true);
    setMessage("Enviando imagem de destaque e matéria…");
    const response = await fetch(`/api/articles/${draft.id}/publish`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status,
        title: draft.title,
        content: draft.content,
        excerpt: draft.excerpt,
        image_url: draft.image_url,
        image_credit: draft.image_credit,
        source_name: draft.source_name,
        source_url: draft.source_url,
        category_id: draft.category_id,
        category_ids: categoryIds(draft),
        author: draft.author,
        tags: draft.tags || [],
      }),
    });
    const data = await response.json();
    if (!response.ok) setMessage(data.error || "Falha de publicação.");
    else {
      setMessage(
        `${status === "draft" ? "Rascunho enviado" : "Publicado"}: ${data.url || "WordPress"}`,
      );
      if (status === "publish")
        setArticles((current) => current.filter((a) => a.id !== draft.id));
      setDraft({
        ...draft,
        editorial_status:
          status === "publish" ? "publicada" : "pronta_para_publicacao",
        wordpress_url: data.url,
        wordpress_post_id: data.id || draft.wordpress_post_id,
        wordpress_media_id: data.mediaId || draft.wordpress_media_id,
      });
    }
    setPublishing(false);
  }
  async function unpublish() {
    if (
      !draft ||
      !session ||
      !window.confirm("Despublicar esta matéria e devolvê-la para revisão?")
    )
      return;
    setPublishing(true);
    setMessage("Retirando a matéria do ar…");
    const response = await fetch(`/api/articles/${draft.id}/unpublish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setMessage(data.error || "Falha ao despublicar.");
    else {
      setMessage("Matéria despublicada e devolvida para revisão.");
      setDraft({
        ...draft,
        editorial_status: "devolvida_para_revisao",
        wordpress_url: data.url || draft.wordpress_url,
      });
      await load();
    }
    setPublishing(false);
  }
  async function clearPanel() {
    if (
      !session ||
      !window.confirm(
        "Limpar todas as matérias do painel PWA? Os posts e rascunhos do WordPress serão preservados.",
      )
    )
      return;
    setSaving(true);
    const response = await fetch("/api/articles/clear", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setMessage(data.error || "Falha ao limpar o painel.");
    else {
      setArticles([]);
      setDraft(null);
      setMessage("Painel limpo. WordPress preservado.");
    }
    setSaving(false);
  }
  async function deleteArticle(article: Article) {
    if (
      !session ||
      !window.confirm(
        `Excluir somente “${article.title}” do painel? O WordPress será preservado.`,
      )
    )
      return;
    const response = await fetch(`/api/articles/${article.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error || "Falha ao excluir a matéria.");
      return;
    }
    if (draft?.id === article.id) setDraft(null);
    setArticles((current) => current.filter((item) => item.id !== article.id));
    setMessage("Matéria excluída do painel. O WordPress foi preservado.");
  }
  if (!session)
    return (
      <main className="admin-shell">
        <section className="admin-card">
          <div className="brand-mark">
            DF<span>JÁ</span>
          </div>
          <h1>Central Editorial</h1>
          <p>Entre para revisar e publicar matérias.</p>
          <form onSubmit={login} className="admin-form">
            <input
              type="email"
              placeholder="Seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit">Entrar</button>
          </form>
          {message && <p className="admin-status">{message}</p>}
        </section>
      </main>
    );
  return (
    <main className="admin-shell editorial-shell">
      <header className="editorial-header">
        <div>
          <div className="brand-mark">
            DF<span>JÁ</span>
          </div>
          <h1>Central Editorial</h1>
          <p>Revisão, imagem e publicação</p>
        </div>
        <nav>
          <a href="/admin/operacao">Operação</a>
          <a href={FEED_URL}>Ver feed</a>
          <button type="button" onClick={() => supabase.auth.signOut()}>
            Sair
          </button>
        </nav>
      </header>
      <section className="editorial-layout">
        <aside className="queue-panel">
          <div className="queue-heading">
            <strong>{viewLabels[view]} ({filtered.length})</strong>
            <div className="queue-actions">
              <button
                type="button"
                className="run-flow-action"
                onClick={runFlow}
                disabled={runningFlow || saving || publishing}
                title="Executar a coleta de novas matérias no n8n"
              >
                {runningFlow ? "Buscando…" : "Buscar novas"}
              </button>
              <button type="button" onClick={newArticle}>
                Nova matéria
              </button>
              <button type="button" onClick={() => load(true)} disabled={refreshing}>
                {refreshing ? "Atualizando…" : "Atualizar"}
              </button>
              <button
                type="button"
                onClick={clearPanel}
                disabled={saving || publishing}
              >
                Limpar painel
              </button>
            </div>
          </div>
          <input
            className="queue-search"
            placeholder="Buscar título, fonte, ID ou status"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="queue-tabs" role="tablist" aria-label="Filtrar matérias">
            {([
              ["all", "Todas", counts.all],
              ["new", "Novas", counts.new],
              ["review", "Em revisão", counts.review],
              ["published", "Publicadas", counts.published],
            ] as const).map(([key, label, count]) => (
              <button
                type="button"
                role="tab"
                aria-selected={view === key}
                className={view === key ? "active" : ""}
                key={key}
                onClick={() => setView(key)}
              >
                {label}<span>{count}</span>
              </button>
            ))}
          </div>
          <div className="queue-list">
            {filtered.map((article) => (
              <div
                className={`queue-item ${draft?.id === article.id ? "selected" : ""}`}
                key={article.id}
                onClick={() => select(article)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ")
                    select(article);
                }}
              >
                {displayImage(article) ? (
                  <img className="queue-thumb" src={displayImage(article) || ""} alt="" />
                ) : (
                  <div className="queue-thumb queue-thumb-fallback">DFJÁ</div>
                )}
                <div className="queue-item-copy">
                  <div className="queue-status-line">
                    <span className={`status-dot ${isPublished(article) ? "published" : ""}`} />
                    <em>{isPublished(article) ? "Publicada" : labels[article.editorial_status]}</em>
                  </div>
                  <strong>{article.title}</strong>
                  <span>{article.source_name || "Fonte não informada"}</span>
                  <small>{formatDate(article.published_at || article.updated_at)}</small>
                </div>
                <button
                  type="button"
                  className="queue-delete"
                  aria-label={`Excluir ${article.title}`}
                  title="Excluir do painel"
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteArticle(article);
                  }}
                >
                  🗑️
                </button>
              </div>
            ))}
            {!filtered.length && (
              <p className="empty-queue">Nenhuma matéria pendente.</p>
            )}
          </div>
        </aside>
        <section className="editor-panel">
          {draft ? (
            <>
              <div className="editor-toolbar">
                <span className="status-pill">
                  {labels[draft.editorial_status]}
                </span>
                <small>{saving ? "Salvando…" : "Autosave ativo"}</small>
                <button type="button" onClick={() => setDraft(null)}>
                  Fechar
                </button>
              </div>
              <div className="editor-form">
                <label>
                  Título
                  <input
                    value={draft.title}
                    onChange={(e) => update("title", e.target.value)}
                  />
                </label>
                <div className="editor-grid">
                  <label>
                    Autor
                    <input
                      value={draft.author || ""}
                      onChange={(e) => update("author", e.target.value)}
                    />
                  </label>
                  <div className="category-field">
                    <span className="field-label">Categorias</span>
                    <div className="category-options">
                      {categories.map((c) => {
                        const selected = categoryIds(draft).includes(c.id);
                        return (
                          <button
                            type="button"
                            className={selected ? "selected" : ""}
                            aria-pressed={selected}
                            key={c.id}
                            onClick={() =>
                              updateCategories(
                                selected
                                  ? categoryIds(draft).filter((id) => id !== c.id)
                                  : [...categoryIds(draft), c.id],
                              )
                            }
                          >
                            {selected ? "✓ " : ""}{c.name}
                          </button>
                        );
                      })}
                    </div>
                    <small className="field-hint">A primeira selecionada é a principal no WordPress.</small>
                  </div>
                </div>
                <label>
                  Tags (separadas por vírgula)
                  <input
                    value={visibleTags(draft.tags).join(", ")}
                    onChange={(e) =>
                      update(
                        "tags",
                        [
                          ...(draft.tags || []).filter((tag) =>
                            tag.startsWith(CATEGORY_TAG_PREFIX),
                          ),
                          ...e.target.value
                            .split(",")
                            .map((tag) => tag.trim())
                            .filter(Boolean),
                        ],
                      )
                    }
                  />
                </label>
                <label>
                  Resumo
                  <textarea
                    rows={3}
                    value={draft.excerpt || ""}
                    onChange={(e) => update("excerpt", e.target.value)}
                  />
                </label>
                <label>
                  Texto completo
                  <textarea
                    className="content-editor"
                    rows={15}
                    value={draft.content}
                    onChange={(e) => update("content", e.target.value)}
                  />
                </label>
                <div className="editor-grid">
                  <label>
                    Fonte
                    <input
                      value={draft.source_name || ""}
                      onChange={(e) => update("source_name", e.target.value)}
                    />
                  </label>
                  <label>
                    URL da fonte
                    <input
                      type="url"
                      value={draft.source_url || ""}
                      onChange={(e) => update("source_url", e.target.value)}
                    />
                  </label>
                </div>
                <div className="image-editor">
                  <label>
                    URL da imagem
                    <input
                      type="url"
                      value={draft.image_url || ""}
                      onChange={(e) => update("image_url", e.target.value)}
                      placeholder="https://..."
                    />
                  </label>
                  <label>
                    Crédito
                    <input
                      value={draft.image_credit || ""}
                      onChange={(e) => update("image_credit", e.target.value)}
                    />
                  </label>
                  <label className="upload-label">
                    Enviar arquivo
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={upload}
                    />
                  </label>
                  {draft.image_url && (
                    <img src={draft.image_url} alt="Pré-visualização" />
                  )}
                  <div className="cover-editor">
                    <div className="cover-editor-heading">
                      <strong>Editor de capa</strong>
                      <span>Opcional · gera uma nova imagem de destaque</span>
                    </div>
                    <div
                      className={`cover-preview cover-preview-${coverPosition} cover-preview-${coverTemplate}`}
                    >
                      {coverTemplate === "dividida" ? (
                        <>
                          <div className="cover-preview-half" style={draft.image_url ? { backgroundImage: `url(${draft.image_url})` } : undefined} />
                          <div className="cover-preview-half" style={{ backgroundImage: `url(${coverSecondImageUrl.trim() || draft.image_url || ""})` }} />
                        </>
                      ) : (
                        <div className="cover-preview-image" style={draft.image_url ? { backgroundImage: `url(${draft.image_url})` } : undefined} />
                      )}
                      <div className="cover-preview-gradient" style={{ opacity: coverGradient / 100 }} />
                      {coverLogoText.trim() && <span className="cover-preview-logo" style={{ background: coverAccent }}>{coverLogoText.trim().slice(0, 18)}</span>}
                      <div className="cover-preview-copy">
                        <strong>{coverTitle || draft.title || "Título da matéria"}</strong>
                        {coverSubtitle && <span>{coverSubtitle}</span>}
                      </div>
                      <div className="cover-preview-feed-copy">
                        <span>DFJÁ · {draft.author || "Redação"}</span>
                        <strong>{draft.title || "Título da matéria"}</strong>
                        <p>{draft.excerpt || "Resumo da matéria exibido no feed."}</p>
                      </div>
                    </div>
                    <div className="cover-editor-options">
                      <label>
                        Modelo
                        <select value={coverTemplate} onChange={(e) => setCoverTemplate(e.target.value)}>
                          <option value="jornal">Jornal</option>
                          <option value="dividida">Dividida (duas imagens)</option>
                          <option value="faixa">Faixa preta</option>
                          <option value="limpa">Limpa</option>
                        </select>
                      </label>
                      <label>
                        Cor de destaque
                        <input type="color" value={coverAccent} onChange={(e) => setCoverAccent(e.target.value)} />
                      </label>
                    </div>
                    <label>
                      Título da capa
                      <input value={coverTitle} onChange={(e) => setCoverTitle(e.target.value)} maxLength={120} />
                    </label>
                    <label>
                      Texto de apoio <span className="field-hint">(opcional)</span>
                      <input value={coverSubtitle} onChange={(e) => setCoverSubtitle(e.target.value)} maxLength={140} />
                    </label>
                    <div className="cover-editor-options">
                      <label>
                        Degradê: {coverGradient}%
                        <input type="range" min="20" max="90" value={coverGradient} onChange={(e) => setCoverGradient(Number(e.target.value))} />
                      </label>
                      <label>
                        Texto
                        <select value={coverPosition} onChange={(e) => setCoverPosition(e.target.value)}>
                          <option value="bottom">Embaixo</option>
                          <option value="top">Em cima</option>
                        </select>
                      </label>
                    </div>
                    <div className="cover-editor-options">
                      <label>
                        Logo ou selo (texto)
                        <input value={coverLogoText} onChange={(e) => setCoverLogoText(e.target.value)} maxLength={18} placeholder="DFJÁ" />
                      </label>
                      <label>
                        Logo personalizado
                        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setCoverLogoFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                    {coverTemplate === "dividida" && (
                      <label>
                        URL da segunda imagem
                        <input type="url" value={coverSecondImageUrl} onChange={(e) => setCoverSecondImageUrl(e.target.value)} placeholder="https://..." />
                      </label>
                    )}
                    <button type="button" className="secondary-action cover-generate" onClick={createCover} disabled={saving || !draft.image_url}>
                      {saving ? "Gerando capa…" : "Criar capa e salvar"}
                    </button>
                  </div>
                </div>
                <div className="editor-actions">
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() =>
                      update("editorial_status", "pronta_para_publicacao")
                    }
                  >
                    Salvar para publicar
                  </button>
                  <button
                    type="button"
                    className="secondary-action"
                    disabled={publishing || !draft.title || !draft.content}
                    onClick={() => publish("draft")}
                  >
                    Enviar rascunho WP
                  </button>
                  <button
                    type="button"
                    className="primary-action"
                    disabled={publishing || !draft.title || !draft.content}
                    onClick={() => publish("publish")}
                  >
                    {publishing ? "Publicando…" : "Publicar no WordPress"}
                  </button>
                  {draft.editorial_status === "publicada" && (
                    <button
                      type="button"
                      className="secondary-action"
                      disabled={publishing || !draft.wordpress_post_id}
                      onClick={unpublish}
                    >
                      Despublicar
                    </button>
                  )}
                </div>
                {draft.last_error && (
                  <p className="error-banner">{draft.last_error}</p>
                )}
                {message && <p className="admin-status">{message}</p>}
              </div>
            </>
          ) : (
            <div className="editor-empty">
              <h2>{view === "published" ? "Feed de publicadas" : "Selecione uma matéria"}</h2>
              <p>
                {view === "published"
                  ? "Acompanhe as matérias já publicadas e abra qualquer uma para revisar seus dados."
                  : "As alterações são salvas automaticamente e a publicação exige confirmação."}
              </p>
              {view === "published" && (
                <div className="published-gallery">
                  {publishedArticles.slice(0, 12).map((article) => (
                    <button type="button" key={article.id} onClick={() => select(article)}>
                      {displayImage(article) ? (
                        <img src={displayImage(article) || ""} alt="" />
                      ) : (
                        <span>DFJÁ</span>
                      )}
                      <strong>{article.title}</strong>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
