-- PWA editorial: estados, auditoria, concorrência e vínculo WordPress.
alter table public.articles
  add column if not exists author text,
  add column if not exists image_credit text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists n8n_item_id text,
  add column if not exists wordpress_post_id bigint,
  add column if not exists wordpress_media_id bigint,
  add column if not exists wordpress_url text,
  add column if not exists editorial_status text not null default 'coletada',
  add column if not exists ai_status text,
  add column if not exists collected_at timestamptz,
  add column if not exists whatsapp_sent_at timestamptz,
  add column if not exists review_started_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists last_error text,
  add column if not exists locked_by uuid,
  add column if not exists locked_at timestamptz,
  add column if not exists version integer not null default 1;

alter table public.articles drop constraint if exists articles_editorial_status_check;
alter table public.articles add constraint articles_editorial_status_check check (editorial_status in (
  'coletada','enviada_whatsapp','aprovada_para_ia','reescrita_ia','em_revisao_pwa',
  'pronta_para_publicacao','publicada','rejeitada','devolvida_para_revisao','erro_publicacao'
));

create unique index if not exists articles_n8n_item_id_unique
  on public.articles(n8n_item_id) where n8n_item_id is not null;
create unique index if not exists articles_wordpress_post_id_unique
  on public.articles(wordpress_post_id) where wordpress_post_id is not null;

create table if not exists public.article_revisions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  changed_by uuid references auth.users(id) on delete set null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.article_revisions enable row level security;
drop policy if exists "authenticated editors can read revisions" on public.article_revisions;
create policy "authenticated editors can read revisions" on public.article_revisions
  for select to authenticated using (true);
drop policy if exists "authenticated editors can create revisions" on public.article_revisions;
create policy "authenticated editors can create revisions" on public.article_revisions
  for insert to authenticated with check (true);

drop policy if exists "authenticated editors can read all articles" on public.articles;
create policy "authenticated editors can read all articles" on public.articles
  for select to authenticated using (true);

create or replace function public.claim_article(p_article_id uuid)
returns boolean language plpgsql security invoker set search_path = public
as $$
begin
  update public.articles
     set locked_by = auth.uid(), locked_at = now()
   where id = p_article_id
     and (locked_by is null or locked_by = auth.uid() or locked_at < now() - interval '30 minutes');
  return found;
end;
$$;

grant execute on function public.claim_article(uuid) to authenticated;

-- Permite o PWA encontrar as categorias editoriais cadastradas no WordPress/Supabase.
insert into public.categories (name, slug) values
  ('DF','df'),('Entorno','entorno'),('Brasil','brasil'),('Política','politica'),
  ('Eleições','eleicoes'),('Câmara & Senado','camara-senado'),
  ('Câmara Legislativa do DF','camara-legislativa-do-df'),('Policial','policial'),
  ('Fato ou Fake','fato-ou-fake'),('Serviços','servicos'),('Emprego e Concursos','emprego-e-concursos'),
  ('Vagas','vagas'),('Tecnologia','tecnologia'),('Concursos','concursos'),('Esporte','esporte'),
  ('Social','social'),('Cultura','cultura')
on conflict (slug) do nothing;
