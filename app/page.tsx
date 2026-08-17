import { getPublishedArticles, type Article } from "../lib/articles";

export const dynamic = "force-dynamic";

const demoStories = [
  {
    category: "Distrito Federal",
    title: "DFNews está chegando com informação local em um novo formato",
    excerpt: "Um feed rápido, visual e direto para acompanhar o que acontece no Distrito Federal e no Centro-Oeste.",
    tone: "tone-blue",
  },
  {
    category: "Serviços",
    title: "Informação útil para a rotina de quem vive no DF",
    excerpt: "Acompanhe mobilidade, serviços públicos, economia, segurança, cultura e os principais acontecimentos da região.",
    tone: "tone-orange",
  },
  {
    category: "Centro-Oeste",
    title: "Um olhar regional, com identidade e voz próprias",
    excerpt: "O projeto será construído para valorizar fontes locais e apresentar notícias com clareza e contexto.",
    tone: "tone-purple",
  },
];

function StoryCard({ story, index }: { story: { category: string; title: string; excerpt: string; tone: string; image_url?: string | null; source_name?: string | null }; index: number }) {
  const backgroundImage = story.image_url ? { backgroundImage: `url(${story.image_url})` } : undefined;

  return (
    <article className={`story ${story.tone}`} style={backgroundImage}>
      <div className="story-overlay" />
      <div className="story-content">
        <div className="story-meta"><span>{story.category}</span><span>{story.source_name || "Agora"}</span></div>
        <h1>{story.title}</h1>
        <p>{story.excerpt}</p>
        <div className="story-footer"><span>DFNews</span><span>{String(index + 1).padStart(2, "0")}</span></div>
      </div>
    </article>
  );
}

export default async function Home() {
  const articles = await getPublishedArticles();
  const stories = articles.length > 0
    ? articles.map((article: Article) => ({
        category: article.category?.[0]?.name || "DFNews",
        title: article.title,
        excerpt: article.excerpt || article.content.slice(0, 180),
        tone: "tone-blue",
        image_url: article.image_url,
        source_name: article.source_name,
      }))
    : demoStories;

  return (
    <main className="feed-shell">
      <header className="topbar">
        <div className="brand-mark" aria-label="DFNews">DF<span>NEWS</span></div>
        <div className="topbar-note">Distrito Federal & Centro-Oeste</div>
      </header>

      <nav className="category-bar" aria-label="Categorias">
        {["Para você", "DF", "Entorno", "Política", "Serviços", "Segurança", "Cultura", "Esportes"].map((item, index) => (
          <button className={index === 0 ? "category active" : "category"} key={item} type="button">
            {item}
          </button>
        ))}
      </nav>

      <section className="feed" aria-label="Feed de notícias">
        {stories.map((story, index) => <StoryCard key={story.title} story={story} index={index} />)}
      </section>
    </main>
  );
}
