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
  last_error: string | null;
  version: number;
  updated_at: string;
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
const fields =
  "id,title,excerpt,content,image_url,image_credit,source_name,source_url,category_id,author,tags,editorial_status,wordpress_url,wordpress_post_id,wordpress_media_id,last_error,version,updated_at";
const FEED_URL = "https://dfja.com.br";

export default function AdminPanel() {
  const [session, setSession] = useState<{
    access_token: string;
    user_id: string;
  } | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [draft, setDraft] = useState<Article | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
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
  async function load() {
    const [a, c] = await Promise.all([
      supabase
        .from("articles")
        .select(fields)
        .not("editorial_status", "eq", "rejeitada")
        .order("updated_at", { ascending: false })
        .limit(200),
      fetch("/api/categories").then((r) => (r.ok ? r.json() : [])),
    ]);
    if (a.error) setMessage(a.error.message);
    else setArticles((a.data || []) as Article[]);
    setCategories(Array.isArray(c) ? c : []);
  }
  useEffect(() => {
    if (session) load();
  }, [session]);
  const filtered = useMemo(
    () =>
      articles.filter((a) =>
        `${a.title} ${a.source_name || ""} ${a.id} ${a.editorial_status}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [articles, query],
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
        .single();
      if (result.error || !result.data)
        setMessage(
          `Autosave falhou: ${result.error?.message || "conflito de versão; recarregue a matéria"}`,
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
          <a href={FEED_URL}>Ver feed</a>
          <button type="button" onClick={() => supabase.auth.signOut()}>
            Sair
          </button>
        </nav>
      </header>
      <section className="editorial-layout">
        <aside className="queue-panel">
          <div className="queue-heading">
            <strong>Fila ({filtered.length})</strong>
            <button type="button" onClick={newArticle}>
              Nova matéria
            </button>
            <button type="button" onClick={load}>
              Atualizar
            </button>
            <button
              type="button"
              onClick={clearPanel}
              disabled={saving || publishing}
            >
              Limpar painel
            </button>
          </div>
          <input
            className="queue-search"
            placeholder="Buscar título, fonte, ID ou status"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="queue-list">
            {filtered.map((article) => (
              <button
                className={`queue-item ${draft?.id === article.id ? "selected" : ""}`}
                key={article.id}
                type="button"
                onClick={() => select(article)}
              >
                <strong>{article.title}</strong>
                <span>{article.source_name || "Fonte não informada"}</span>
                <em>{labels[article.editorial_status]}</em>
              </button>
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
                  <label>
                    Categoria
                    <select
                      value={draft.category_id || ""}
                      onChange={(e) => update("category_id", e.target.value)}
                    >
                      <option value="">Selecionar categoria</option>
                      {categories.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Tags (separadas por vírgula)
                  <input
                    value={(draft.tags || []).join(", ")}
                    onChange={(e) =>
                      update(
                        "tags",
                        e.target.value
                          .split(",")
                          .map((tag) => tag.trim())
                          .filter(Boolean),
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
              <h2>Selecione uma matéria</h2>
              <p>
                As alterações são salvas automaticamente e a publicação exige
                confirmação.
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
