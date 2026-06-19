-- ============================================================================
--  CK3FR RP — Migration 0011 : Pactes & Diplomatie
--
--  Un pacte (traité) est proposé par un joueur et lie plusieurs maisons. Chaque
--  maison signataire le ratifie via l'un de ses joueurs. Lecture publique.
--
--  À exécuter dans le SQL Editor de Supabase (après 0010).
-- ============================================================================

create table if not exists public.pacts (
  id             uuid primary key default gen_random_uuid(),
  author_profile uuid not null references public.profiles (id) on delete cascade,
  title          text not null,
  body           text not null default '',
  created_at     timestamptz not null default now()
);

create table if not exists public.pact_houses (
  pact_id   uuid not null references public.pacts (id) on delete cascade,
  house_key text not null,
  signed_by uuid references public.profiles (id) on delete set null,
  signed_at timestamptz,
  primary key (pact_id, house_key)
);

-- Maison du joueur courant (SECURITY DEFINER → pas de récursion RLS).
create or replace function public.current_house()
returns text language sql stable security definer set search_path = public as $$
  select house from public.profiles where id = auth.uid();
$$;

alter table public.pacts       enable row level security;
alter table public.pact_houses enable row level security;

-- pacts : lecture publique ; création par soi (non-observateur) ; suppression auteur/admin.
create policy "pacts_select" on public.pacts
  for select to authenticated using (true);
create policy "pacts_insert" on public.pacts
  for insert to authenticated with check (author_profile = auth.uid() and not public.is_observer(auth.uid()));
create policy "pacts_delete" on public.pacts
  for delete to authenticated using (author_profile = auth.uid() or public.is_admin(auth.uid()));

-- pact_houses : lecture publique ; l'auteur du pacte ajoute les maisons ;
--               signature par un joueur de la maison concernée (ou admin).
create policy "pact_houses_select" on public.pact_houses
  for select to authenticated using (true);
create policy "pact_houses_insert" on public.pact_houses
  for insert to authenticated with check (
    exists (select 1 from public.pacts p where p.id = pact_id and p.author_profile = auth.uid())
  );
create policy "pact_houses_sign" on public.pact_houses
  for update to authenticated
  using (house_key = public.current_house() or public.is_admin(auth.uid()))
  with check (house_key = public.current_house() or public.is_admin(auth.uid()));
create policy "pact_houses_delete" on public.pact_houses
  for delete to authenticated using (
    exists (select 1 from public.pacts p where p.id = pact_id and (p.author_profile = auth.uid() or public.is_admin(auth.uid())))
  );

alter publication supabase_realtime add table public.pacts;
alter publication supabase_realtime add table public.pact_houses;

-- ============================================================================
--  Fin de la migration 0011.
-- ============================================================================
