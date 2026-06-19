-- ============================================================================
--  CK3FR RP — Migration 0019 : Le Trône de Fer & les allégeances
--
--  - throne_claims : une maison revendique le Trône de Fer (1 par maison).
--  - fealty        : une maison jure allégeance à une autre (liège).
--  Chaque maison ne gère QUE sa propre revendication / allégeance (ou un Mestre).
--
--  À exécuter dans le SQL Editor de Supabase (après 0018).
-- ============================================================================

-- Maison du joueur courant (créée ici par sécurité si la 0011 n'a pas été passée).
create or replace function public.current_house()
returns text language sql stable security definer set search_path = public as $$
  select house from public.profiles where id = auth.uid();
$$;

create table if not exists public.throne_claims (
  house_key        text primary key,
  claimant_profile uuid references public.profiles (id) on delete set null,
  justification    text,
  created_at       timestamptz not null default now()
);

create table if not exists public.fealty (
  vassal_house text primary key,
  liege_house  text not null,
  sworn_by     uuid references public.profiles (id) on delete set null,
  sworn_at     timestamptz not null default now(),
  constraint fealty_not_self check (vassal_house <> liege_house)
);

alter table public.throne_claims enable row level security;
alter table public.fealty        enable row level security;

create policy "throne_select" on public.throne_claims
  for select to authenticated using (true);
create policy "throne_write" on public.throne_claims
  for all to authenticated
  using (house_key = public.current_house() or public.is_admin(auth.uid()))
  with check (house_key = public.current_house() or public.is_admin(auth.uid()));

create policy "fealty_select" on public.fealty
  for select to authenticated using (true);
create policy "fealty_write" on public.fealty
  for all to authenticated
  using (vassal_house = public.current_house() or public.is_admin(auth.uid()))
  with check (vassal_house = public.current_house() or public.is_admin(auth.uid()));

alter publication supabase_realtime add table public.throne_claims;
alter publication supabase_realtime add table public.fealty;

-- ============================================================================
--  Fin de la migration 0019.
-- ============================================================================
