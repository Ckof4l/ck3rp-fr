-- ============================================================================
--  CK3FR RP — Migration 0023 : la bannière d'annonce (message du jour) est
--  désormais réservée au GRAND MESTRE (fondateur), plus à tous les Mestres.
--
--  À exécuter dans le SQL Editor de Supabase (après 0022).
-- ============================================================================

-- Pose de la bannière : seul un Grand Mestre (is_founder) peut le faire.
create or replace function public.set_announcement(p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if not public.is_founder(v_uid) then raise exception 'Réservé au Grand Mestre.'; end if;
  if coalesce(trim(p_message), '') = '' then raise exception 'Le message est vide.'; end if;

  delete from public.announcements;
  insert into public.announcements (message, author_profile)
  values (trim(p_message), v_uid);
end;
$$;
grant execute on function public.set_announcement(text) to authenticated;

-- Écriture directe (le retrait de la bannière) : Grand Mestre uniquement.
drop policy if exists "announcements_admin_write" on public.announcements;
drop policy if exists "announcements_founder_write" on public.announcements;
create policy "announcements_founder_write" on public.announcements
  for all to authenticated
  using (public.is_founder(auth.uid())) with check (public.is_founder(auth.uid()));

-- ============================================================================
--  Fin de la migration 0023.
-- ============================================================================
