import { supabase } from "./supabase";

export type Article = {
  id: string;
  title: string;
  excerpt: string | null;
  content: string;
  image_url: string | null;
  video_url: string | null;
  source_name: string | null;
  published_at: string | null;
  category: { name: string }[] | null;
};

export async function getPublishedArticles(): Promise<Article[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("id,title,excerpt,content,image_url,video_url,source_name,published_at,category:categories(name)")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Unable to load articles", error.message);
    return [];
  }

  return (data ?? []) as Article[];
}
