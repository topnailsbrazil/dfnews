"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Category = { id: string; name: string };

export default function AdminPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(Boolean(data.session)));
    supabase.from("categories").select("id,name").order("name").then(({ data }) => setCategories(data || []));
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setStatus("Entrando...");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setStatus(error.message);
    setSession(true);
    setStatus("");
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    setStatus("Publicando...");
    const slug = `${title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now()}`;
    const { error } = await supabase.from("articles").insert({
      title, slug, excerpt, content, category_id: categoryId || null,
      source_url: sourceUrl || null, source_name: sourceName || null,
      status: "published", published_at: new Date().toISOString(),
    });
    if (error) return setStatus(error.message);
    setTitle(""); setExcerpt(""); setContent(""); setSourceUrl(""); setSourceName("");
    setStatus("Artigo publicado com sucesso.");
  }

  if (!session) return (
    <main className="admin-shell"><section className="admin-card">
      <div className="brand-mark">DF<span>NEWS</span></div><h1>Área editorial</h1>
      <p>Entre para publicar no DFNews.</p>
      <form onSubmit={login} className="admin-form">
        <input type="email" placeholder="Seu e-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Sua senha Supabase" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit">Entrar</button>
      </form>{status && <p className="admin-status">{status}</p>}
    </section></main>
  );

  return <main className="admin-shell"><section className="admin-card wide">
    <div className="admin-heading"><div><div className="brand-mark">DF<span>NEWS</span></div><h1>Novo artigo</h1></div><a href="/">Ver feed</a></div>
    <form onSubmit={publish} className="admin-form">
      <input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <input placeholder="Resumo curto" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
      <textarea placeholder="Texto da notícia" value={content} onChange={(e) => setContent(e.target.value)} rows={10} required />
      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
      <input placeholder="Nome da fonte (opcional)" value={sourceName} onChange={(e) => setSourceName(e.target.value)} />
      <input type="url" placeholder="URL da fonte (opcional)" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
      <button type="submit">Publicar artigo</button>
    </form>{status && <p className="admin-status">{status}</p>}
  </section></main>;
}
