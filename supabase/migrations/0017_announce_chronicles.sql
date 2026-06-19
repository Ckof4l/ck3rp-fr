-- ============================================================================
--  CK3FR RP — Migration 0017 : bannière d'annonce + chroniques du royaume
--
--  - announcements : un bandeau global posé par un Mestre (le plus récent
--    s'affiche en haut du site pour tout le monde).
--  - chronicles    : les événements marquants / annales du royaume, écrits
--    par les Mestres et lus par tous.
--
--  À exécuter dans le SQL Editor de Supabase (après 0016).
-- ============================================================================

create table if not exists public.announcements (
  id             uuid primary key default gen_random_uuid(),
  message        text not null,
  author_profile uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create table if not exists public.chronicles (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  body           text not null default '',
  event_date     date,
  author_profile uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists chronicles_date_idx on public.chronicles (created_at desc);

alter table public.announcements enable row level security;
alter table public.chronicles    enable row level security;

-- announcements : lus par tous ; posés/retirés par les Mestres.
create policy "announcements_select" on public.announcements
  for select to authenticated using (true);
create policy "announcements_admin_write" on public.announcements
  for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- chronicles : lues par tous ; écrites/supprimées par les Mestres.
create policy "chronicles_select" on public.chronicles
  for select to authenticated using (true);
create policy "chronicles_admin_write" on public.chronicles
  for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

alter publication supabase_realtime add table public.announcements;
alter publication supabase_realtime add table public.chronicles;

-- ============================================================================
--  Fin de la migration 0017.
-- ============================================================================
