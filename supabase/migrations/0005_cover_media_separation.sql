-- Mantém a imagem limpa da matéria separada da capa editorial.
alter table public.articles
  add column if not exists cover_image_url text,
  add column if not exists cover_media_id bigint;
