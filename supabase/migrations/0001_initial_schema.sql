create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text not null,
  image_url text,
  video_url text,
  category_id uuid references public.categories(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  published_at timestamptz,
  source_name text,
  source_url text,
  source_guid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists articles_source_guid_unique
  on public.articles(source_guid) where source_guid is not null;

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  feed_url text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  author_name text not null,
  author_email text,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;
alter table public.articles enable row level security;
alter table public.sources enable row level security;
alter table public.comments enable row level security;

create policy "public can read categories"
  on public.categories for select using (true);

create policy "public can read published articles"
  on public.articles for select using (status = 'published');

create policy "public can read active sources"
  on public.sources for select using (active = true);

create policy "public can read approved comments"
  on public.comments for select using (status = 'approved');

create policy "public can submit comments"
  on public.comments for insert with check (status = 'pending');

insert into public.categories (name, slug) values
  ('Distrito Federal', 'distrito-federal'),
  ('Entorno', 'entorno'),
  ('Centro-Oeste', 'centro-oeste'),
  ('Política', 'politica'),
  ('Serviços', 'servicos'),
  ('Segurança', 'seguranca'),
  ('Cultura', 'cultura'),
  ('Esportes', 'esportes')
on conflict (slug) do nothing;
