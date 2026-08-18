"use client";

import { useMemo, useState } from "react";

const categories = ["Para você", "DF", "Entorno", "Brasil", "Policial", "Fato ou Fake", "Emprego e Concursos", "Vagas", "Tecnologia", "Esporte", "Cultura", "Social"];

export default function FeedDemo({ stories }: { stories: Array<{ category: string; title: string; excerpt: string; tone: string; image_url?: string | null; source_name?: string | null }> }) {
  const [selected, setSelected] = useState("Para você");
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, string[]>>({});
  const [commenting, setCommenting] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [shared, setShared] = useState<string | null>(null);
  const visible = useMemo(() => selected === "Para você" ? stories : stories.filter((story) => story.category === selected), [selected, stories]);

  return <div className="device-stage"><div className="phone-frame"><div className="phone-screen">
    <nav className="category-bar" aria-label="Categorias">
      {categories.map((item) => <button className={selected === item ? "category active" : "category"} key={item} onClick={() => setSelected(item)} type="button">{item}</button>)}
    </nav>
    <aside className="breaking-bar"><strong>🔥 Acompanhe agora em tempo real:</strong><span>Brasília e Entorno em destaque</span><span>Serviços e oportunidades</span><span>Segurança e mobilidade</span></aside>
    <section className="feed" aria-label="Feed de notícias">
      {visible.length ? visible.map((story, index) => <div key={story.title}>
        <article className={`story ${story.tone}`} style={story.image_url ? { backgroundImage: `url(${story.image_url})` } : undefined}>
          <div className="story-overlay" /><div className="story-content"><div className="story-meta"><span>{story.category}</span><span>{story.source_name || "DFJÁ agora"}</span></div><div className="story-avatar" aria-label="Ícone DFJÁ">DF<span>JÁ</span></div><h1>{story.title}</h1><p>{story.excerpt}</p><div className="story-hint">‹ &nbsp; Deslize para ler &nbsp; ›</div><div className="story-footer"><span>DFJÁ</span><span>{String(index + 1).padStart(2, "0")}</span></div></div><div className="social-rail" aria-label="Ações da notícia"><button className={liked[story.title] ? "social-action is-liked" : "social-action"} type="button" aria-label="Curtir" onClick={() => setLiked((state) => ({ ...state, [story.title]: !state[story.title] }))}><span>♥</span><small>{liked[story.title] ? 1 : 0}</small></button><button className="social-action" type="button" aria-label="Compartilhar" onClick={async () => { try { await navigator.clipboard?.writeText(window.location.href); } catch {} setShared(story.title); setTimeout(() => setShared(null), 1600); }}><span>↗</span><small>{shared === story.title ? "Copiado" : "Enviar"}</small></button><button className={commenting === story.title ? "social-action is-commenting" : "social-action"} type="button" aria-label="Comentar" onClick={() => setCommenting(commenting === story.title ? null : story.title)}><span>▢</span><small>{comments[story.title]?.length || 0}</small></button></div>
          {commenting === story.title && <div className="comment-box"><strong>Comentar</strong><textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Escreva um comentário…" /><button type="button" onClick={() => { if (!commentText.trim()) return; setComments((state) => ({ ...state, [story.title]: [...(state[story.title] || []), commentText.trim()] })); setCommentText(""); setCommenting(null); }}>Enviar comentário</button></div>}
        </article>
        {index === 2 && <div className="institutional-slot" aria-label="Espaço publicitário institucional"><small>PUBLICIDADE</small><strong>Espaço reservado para banner institucional</strong><span>DFJÁ • anuncie aqui</span></div>}
      </div>) : <div className="empty-feed">Nenhuma notícia nesta categoria ainda.</div>}
    </section>
  </div></div></div>;
}
