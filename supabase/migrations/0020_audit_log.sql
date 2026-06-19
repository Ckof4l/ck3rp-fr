-- ============================================================================
--  CK3FR RP — Migration 0020 : journal d'audit des actions admin
--
--  audit_log : qui a fait quoi (bans, rôles, sourdines, suppressions…).
--  Écrit via la fonction log_admin (réservée aux Mestres), lu par les Mestres.
--
--  À exécuter dans le SQL Editor de Supabase (après 0019).
-- ============================================================================

create table if not exists public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_profile uuid references public.profiles (id) on delete set null,
  action        text not null,
  created_at    timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

-- Lecture réservée aux Mestres. (Écriture uniquement via log_admin ci-dessous.)
create policy "audit_select_admin" on public.audit_log
  for select to authenticated using (public.is_admin(auth.uid()));

create or replace function public.log_admin(p_action text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then return; end if;
  insert into public.audit_log (actor_profile, action) values (auth.uid(), p_action);
end;
$$;
grant execute on function public.log_admin(text) to authenticated;

-- ============================================================================
--  Fin de la migration 0020.
-- ============================================================================
