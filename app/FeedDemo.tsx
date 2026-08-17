"use client";

import { useMemo, useState } from "react";

const categories = ["Para você", "DF", "Entorno", "Fato ou Fake", "Tecnologia", "Concursos", "Emprego"];

export default function FeedDemo({ stories }: { stories: Array<{ category: string; title: string; excerpt: string; tone: string; image_url?: string | null; source_name?: string | null }> }) {
  const [selected, setSelected] = useState("Para você");
  const visible = useMemo(() => selected === "Para você" ? stories : stories.filter((story) => story.category === selected), [selected, stories]);

  return <>
    <nav className="category-bar" aria-label="Categorias">
      {categories.map((item) => <button className={selected === item ? "category active" : "category"} key={item} onClick={() => setSelected(item)} type="button">{item}</button>)}
    </nav>
    <section className="feed" aria-label="Feed de notícias">
      {visible.length ? visible.map((story, index) => <article key={story.title} className={`story ${story.tone}`} style={story.image_url ? { backgroundImage: `url(${story.image_url})` } : undefined}>
        <div className="story-overlay" /><div className="story-content"><div className="story-meta"><span>{story.category}</span><span>{story.source_name || "DFJA agora"}</span></div><h1>{story.title}</h1><p>{story.excerpt}</p><div className="story-footer"><span>DFNews</span><span>{String(index + 1).padStart(2, "0")}</span></div></div>
      </article>) : <div className="empty-feed">Nenhuma notícia nesta categoria ainda.</div>}
    </section>
  </>;
}
