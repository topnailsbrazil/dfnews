create policy "authenticated editors can create articles"
  on public.articles for insert to authenticated with check (true);

create policy "authenticated editors can update articles"
  on public.articles for update to authenticated using (true) with check (true);

create policy "authenticated editors can delete articles"
  on public.articles for delete to authenticated using (true);
