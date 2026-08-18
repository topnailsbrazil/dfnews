import { getPublishedArticles, type Article } from "../lib/articles";
import FeedDemo from "./FeedDemo";

export const dynamic = "force-dynamic";

const demoStories = [
  {
    category: "Distrito Federal",
    title: "DFJÁ está chegando com informação local em um novo formato",
    excerpt: "Um feed rápido, visual e direto para acompanhar o que acontece no Distrito Federal e no Entorno.",
    tone: "tone-blue",
    image_url: "https://images.unsplash.com/photo-1585202900225-6d3ac20a6962?auto=format&fit=crop&w=1600&q=80",
  },
  {
    category: "Serviços",
    title: "Informação útil para a rotina de quem vive no DF",
    excerpt: "Acompanhe mobilidade, serviços públicos, economia, segurança, cultura e os principais acontecimentos da região.",
    tone: "tone-orange",
    image_url: "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1600&q=80",
  },
  {
    category: "Entorno",
    title: "Um olhar regional, com identidade e voz próprias",
    excerpt: "O projeto será construído para valorizar fontes locais e apresentar notícias com clareza e contexto.",
    tone: "tone-purple",
    image_url: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1600&q=80",
  },
  { category: "Fato ou Fake", title: "DFJÁ explica: como conferir uma informação antes de compartilhar", excerpt: "Veja sinais de alerta e fontes oficiais para verificar conteúdos que circulam nas redes sociais.", tone: "tone-green", image_url: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1600&q=80" },
  { category: "Tecnologia", title: "Serviços digitais ganham espaço na rotina dos moradores do DF", excerpt: "Aplicativos e plataformas públicas ajudam a resolver demandas sem deslocamento.", tone: "tone-cyan", image_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80", video_url: "demo", instagram_url: "demo" },
  { category: "Concursos", title: "Concursos e seleções movimentam oportunidades no Distrito Federal", excerpt: "Acompanhe editais, inscrições, prazos e informações confirmadas pelos órgãos responsáveis.", tone: "tone-orange", image_url: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1600&q=80" },
  { category: "Emprego e Concursos", title: "Feiras e vagas aproximam candidatos de empresas no DF e Entorno", excerpt: "Confira oportunidades e orientações para participar dos processos seletivos.", tone: "tone-purple", image_url: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1600&q=80" },
  { category: "Policial", title: "Segurança no DF: acompanhe as ocorrências confirmadas", excerpt: "Informações verificadas pelas autoridades, com contexto e serviço para a população.", tone: "tone-blue", image_url: "https://images.unsplash.com/photo-1453873531674-2151bcd01707?auto=format&fit=crop&w=1600&q=80" },
  { category: "Vagas", title: "Oportunidades abertas para quem busca recolocação", excerpt: "Veja como participar e confira os canais oficiais de inscrição.", tone: "tone-cyan", image_url: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1600&q=80" },
  { category: "Esporte", title: "Esporte local ganha espaço na agenda do DF", excerpt: "Resultados, competições e personagens que movimentam Brasília e as cidades do Entorno.", tone: "tone-green", image_url: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1600&q=80" },
  { category: "Social", title: "Eventos e iniciativas que movimentam a comunidade", excerpt: "Projetos, encontros e ações que fazem parte da vida do DF.", tone: "tone-orange", image_url: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=80" },
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
        <div className="story-footer"><span>DFJÁ</span><span>{String(index + 1).padStart(2, "0")}</span></div>
      </div>
    </article>
  );
}

export default async function Home() {
  const articles = await getPublishedArticles();
  const publishedStories = articles.map((article: Article) => ({
        category: article.category?.[0]?.name || "DFJÁ",
        title: article.title,
        excerpt: article.excerpt || article.content.slice(0, 180),
        tone: "tone-blue",
        image_url: article.image_url,
        source_name: article.source_name,
        video_url: null,
        instagram_url: null,
      }));
  const stories = [...publishedStories, ...demoStories];

  return (
    <main className="feed-shell">
      <header className="topbar">
        <div className="brand-mark" aria-label="DFJÁ">DF<span>JÁ</span></div>
        <div className="topbar-note">Distrito Federal & Entorno</div>
      </header>

      <FeedDemo stories={stories} />
    </main>
  );
}
