"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Article = {
  id: string;
  title: string;
  source_name: string | null;
  editorial_status: string | null;
  ai_status: string | null;
  status: string | null;
  wordpress_post_id: number | null;
  wordpress_url: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

const statusLabels: Record<string, string> = {
  coletada: "Coletada",
  enviada_whatsapp: "WhatsApp enviado",
  aprovada_para_ia: "Aprovada para IA",
  reescrita_ia: "Reescrita pela IA",
  em_revisao_pwa: "Em revisão no PWA",
  pronta_para_publicacao: "Pronta para publicar",
  publicada: "Publicada",
  rejeitada: "Rejeitada",
  devolvida_para_revisao: "Devolvida",
  erro_publicacao: "Erro de publicação",
};

const links = [
  ["PWA editorial", "https://dfnews-ten.vercel.app/admin"],
  ["n8n", "https://n8n.dfja.com.br"],
  ["Google Sheets", "https://docs.google.com/spreadsheets/d/1_tL_kPprM4Q1p7DKunBlFhsTBgfjFU6iHFb_8SCRekc/edit"],
  ["Rascunhos WordPress", "https://dfja.com.br/wp-admin/edit.php?post_status=draft"],
];

function label(status: string | null) {
  return (status && statusLabels[status]) || status || "Sem status";
}

function date(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function OperationsDashboard() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [runningFlow, setRunningFlow] = useState(false);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    const result = await supabase
      .from("articles")
      .select("id,title,source_name,editorial_status,ai_status,status,wordpress_post_id,wordpress_url,last_error,created_at,updated_at,published_at")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (result.error) setMessage(`Não foi possível carregar a operação: ${result.error.message}`);
    else {
      setArticles((result.data || []) as Article[]);
      setMessage("");
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  const runFlow = useCallback(async () => {
    setRunningFlow(true);
    setMessage("");
    try {
      const response = await fetch("/api/operations/run-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "pwa-operacao" }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `O n8n recusou o disparo (${response.status}).`);
      setMessage("Fluxo disparado. A coleta e o despacho respeitarão a idempotência da fila.");
      window.setTimeout(() => load(true), 1500);
    } catch (error) {
      setMessage(`Não foi possível rodar o fluxo: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    } finally {
      setRunningFlow(false);
    }
  }, [load]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessionReady(Boolean(data.session)));
    const listener = supabase.auth.onAuthStateChange((_event, session) => setSessionReady(Boolean(session)));
    return () => listener.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    load();
    const timer = window.setInterval(() => load(), 30000);
    return () => window.clearInterval(timer);
  }, [load, sessionReady]);

  const counts = useMemo(() => {
    const by = (statuses: string[]) => articles.filter((a) => statuses.includes(a.editorial_status || "")).length;
    return {
      total: articles.length,
      queue: by(["coletada", "enviada_whatsapp", "aprovada_para_ia"]),
      ai: by(["aprovada_para_ia", "reescrita_ia"]),
      review: by(["em_revisao_pwa", "pronta_para_publicacao"]),
      published: by(["publicada"]) || articles.filter((a) => a.status === "published").length,
      errors: by(["erro_publicacao"]) + articles.filter((a) => Boolean(a.last_error)).length,
    };
  }, [articles]);

  if (!sessionReady) {
    return <main className="admin-shell"><section className="admin-card"><h1>Acesso editorial</h1><p>Entre no <a href="/admin">/admin</a> para acompanhar a operação.</p></section></main>;
  }

  return (
    <main className="ops-shell">
      <header className="ops-header">
        <div>
          <a className="ops-brand" href="/admin">DF<span>JÁ</span></a>
          <h1>Painel de operação</h1>
          <p>Visão única da fila editorial, IA, PWA e WordPress</p>
        </div>
        <nav className="ops-nav"><a href="/admin">Central editorial</a><button className="ops-run-flow" type="button" onClick={runFlow} disabled={runningFlow}>{runningFlow ? "Rodando…" : "Rodar fluxo"}</button><button type="button" onClick={() => supabase.auth.signOut()}>Sair</button></nav>
      </header>

      <section className="ops-links" aria-label="Acessos operacionais">
        {links.map(([name, href]) => <a key={href} href={href} target="_blank" rel="noreferrer">{name}<span>↗</span></a>)}
      </section>

      <section className="ops-grid" aria-label="Resumo da operação">
        <div className="ops-metric"><span>Matérias carregadas</span><strong>{counts.total}</strong><small>últimos 500 registros</small></div>
        <div className="ops-metric accent"><span>Fila de aprovação</span><strong>{counts.queue}</strong><small>coleta e WhatsApp</small></div>
        <div className="ops-metric"><span>IA / processamento</span><strong>{counts.ai}</strong><small>aprovadas ou reescritas</small></div>
        <div className="ops-metric"><span>PWA / revisão</span><strong>{counts.review}</strong><small>aguardando edição/publicação</small></div>
        <div className="ops-metric success"><span>Publicadas</span><strong>{counts.published}</strong><small>estado sincronizado</small></div>
        <div className="ops-metric danger"><span>Com erro</span><strong>{counts.errors}</strong><small>verifique antes de avançar</small></div>
      </section>

      <section className="ops-card">
        <div className="ops-card-heading"><div><h2>Fluxo editorial</h2><p>Os registros abaixo vêm diretamente do banco editorial do PWA.</p></div><button className="ops-refresh" type="button" onClick={() => load(true)} disabled={refreshing}>{refreshing ? "Atualizando…" : "Atualizar agora"}</button></div>
        {message && <p className="ops-error">{message}</p>}
        {loading ? <p className="ops-empty">Carregando operação…</p> : !articles.length ? <p className="ops-empty">Nenhuma matéria encontrada.</p> : (
          <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Matéria</th><th>Etapa</th><th>IA</th><th>WordPress</th><th>Última alteração</th></tr></thead><tbody>
            {articles.slice(0, 100).map((article) => <tr key={article.id}><td><strong>{article.title}</strong><small>{article.source_name || "Fonte não informada"}</small></td><td><span className={`ops-status ${article.editorial_status === "erro_publicacao" || article.last_error ? "error" : article.editorial_status === "publicada" ? "done" : ""}`}>{label(article.editorial_status)}</span></td><td>{article.ai_status || "—"}</td><td>{article.wordpress_post_id ? <a href={article.wordpress_url || "https://dfja.com.br/wp-admin/edit.php?post_status=draft"} target="_blank" rel="noreferrer">ID {article.wordpress_post_id} ↗</a> : "Não enviado"}</td><td>{date(article.updated_at)}<small>{article.last_error ? `Erro: ${article.last_error.slice(0, 100)}` : `Criada ${date(article.created_at)}`}</small></td></tr>)}
          </tbody></table></div>
        )}
      </section>
      <p className="ops-note">Atualização automática a cada 30 segundos. O painel não armazena nem expõe chaves do n8n, WhatsApp, Google ou WordPress.</p>
    </main>
  );
}
