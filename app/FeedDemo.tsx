"use client";

import { useMemo, useRef, useState } from "react";

const categories = ["Para você", "DF", "Entorno", "Brasil", "Policial", "Fato ou Fake", "Emprego e Concursos", "Vagas", "Tecnologia", "Esporte", "Cultura", "Social"];

export default function FeedDemo({ stories }: { stories: Array<{ category: string; title: string; excerpt: string; tone: string; image_url?: string | null; source_name?: string | null }> }) {
  const [selected, setSelected] = useState("Para você");
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, string[]>>({});
  const [commenting, setCommenting] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [readerComment, setReaderComment] = useState("");
  const [shared, setShared] = useState<string | null>(null);
  const [openStory, setOpenStory] = useState<(typeof stories)[number] | null>(null);
  const touchStart = useRef<number | null>(null);
  const visible = useMemo(() => selected === "Para você" ? stories : stories.filter((story) => story.category === selected), [selected, stories]);

  const Icon = ({ type }: { type: "like" | "share" | "comment" }) => type === "like" ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v10H4V10h3Zm2 10V10l4-8 1 1c.7.8.8 1.9.4 2.9L13.5 9H19c1.1 0 2 .9 2 2l-1 7c-.2 1.1-1.1 2-2.2 2H9Z" /></svg> : type === "share" ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2.2" /><circle cx="17.5" cy="5.5" r="2.2" /><circle cx="17.5" cy="18.5" r="2.2" /><path d="m7.8 11 7.6-4.3M7.8 13l7.6 4.3" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v11H9l-4 3V5Z" /></svg>;

  return <div className="device-stage"><div className="phone-frame"><div className="phone-screen">
    <nav className="category-bar" aria-label="Categorias">
      {categories.map((item) => <button className={selected === item ? "category active" : "category"} key={item} onClick={() => setSelected(item)} type="button">{item}</button>)}
    </nav>
    <aside className="breaking-bar"><strong>🔥 Acompanhe agora em tempo real:</strong><span>Brasília e Entorno em destaque</span><span>Serviços e oportunidades</span><span>Segurança e mobilidade</span></aside>
    <section className="feed" aria-label="Feed de notícias">
      {visible.length ? visible.map((story, index) => <div key={story.title}>
        <article className={`story ${story.tone}`} style={story.image_url ? { backgroundImage: `url(${story.image_url})` } : undefined} onClick={() => setOpenStory(story)} onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientY || null; }} onTouchEnd={(event) => { const start = touchStart.current; const end = event.changedTouches[0]?.clientY || start || 0; if (start !== null && start - end > 45) setOpenStory(story); touchStart.current = null; }}>
          <div className="story-overlay" /><div className="story-content"><div className="story-meta"><span>{story.category}</span><span>{story.source_name || "DFJÁ agora"}</span></div><h1>{story.title}</h1><p>{story.excerpt}</p><div className="story-hint">‹ &nbsp; Deslize para ler &nbsp; ›</div><div className="story-footer"><span>DFJÁ</span><span>{String(index + 1).padStart(2, "0")}</span></div></div><div className="social-rail" aria-label="Menu social da notícia"><div className="story-avatar" aria-label="Ícone DFJÁ">DF<span>JÁ</span></div><button className={liked[story.title] ? "social-action is-liked" : "social-action"} type="button" aria-label="Curtir" onClick={(event) => { event.stopPropagation(); setLiked((state) => ({ ...state, [story.title]: !state[story.title] })); }}><Icon type="like" /><small>{liked[story.title] ? 1 : 0}</small></button><button className="social-action" type="button" aria-label="Compartilhar" onClick={async (event) => { event.stopPropagation(); try { await navigator.clipboard?.writeText(window.location.href); } catch {} setShared(story.title); setTimeout(() => setShared(null), 1600); }}><Icon type="share" /><small>{shared === story.title ? "Copiado" : "Share"}</small></button><button className="social-action" type="button" aria-label="Comentar" onClick={(event) => { event.stopPropagation(); setOpenStory(story); }}><Icon type="comment" /><small>{comments[story.title]?.length || 0}</small></button></div>
          {commenting === story.title && <div className="comment-box" onClick={(event) => event.stopPropagation()}><strong>Comentar</strong><textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Escreva um comentário…" /><button type="button" onClick={() => { if (!commentText.trim()) return; setComments((state) => ({ ...state, [story.title]: [...(state[story.title] || []), commentText.trim()] })); setCommentText(""); setCommenting(null); }}>Enviar comentário</button></div>}
        </article>
        {index === 2 && <div className="institutional-slot" aria-label="Espaço publicitário institucional"><small>PUBLICIDADE</small><strong>Espaço reservado para banner institucional</strong><span>DFJÁ • anuncie aqui</span></div>}
      </div>) : <div className="empty-feed">Nenhuma notícia nesta categoria ainda.</div>}
    </section>
  </div>{openStory && <div className="story-reader" role="dialog" aria-modal="true" onClick={() => setOpenStory(null)}><article onClick={(event) => event.stopPropagation()}><button className="reader-close" type="button" aria-label="Fechar matéria" onClick={() => setOpenStory(null)}>×</button>{openStory.image_url && <img src={openStory.image_url} alt="" />}<div className="reader-content"><div className="story-meta"><span>{openStory.category}</span><span>DFJÁ • agora</span></div><h2>{openStory.title}</h2><p className="reader-lead">{openStory.excerpt}</p><div className="video-placeholder"><span>▶</span><strong>Vídeo da matéria</strong><small>Espaço preparado para vídeo incorporado</small></div><p>Esta é uma prévia da matéria reescrita pelo DFJÁ. O conteúdo final será produzido pela IA a partir de fontes selecionadas, conferido pelo editor e apresentado com linguagem própria, contexto local e informações verificadas.</p><p>Na publicação completa, o leitor encontrará os principais fatos, os dados disponíveis e a referência da fonte original. A matéria só será publicada depois da aprovação editorial pelo WhatsApp.</p><div className="reader-comments"><strong>Comentários</strong><textarea value={readerComment} onChange={(event) => setReaderComment(event.target.value)} placeholder="Comente nesta matéria…" /><button type="button" onClick={() => setReaderComment("")}>Enviar comentário</button></div><div className="reader-source">Fonte de referência: portal selecionado • Texto demonstrativo</div></div></article></div>}</div></div>;
}
