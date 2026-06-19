-- ============================================================================
--  CK3FR RP — Migration 0031 : DELETE avec clause WHERE (sql_safe_updates)
--
--  Via l'API, Supabase active sql_safe_updates → un DELETE sans WHERE est
--  refusé (« DELETE requires a WHERE clause », 21000). set_announcement et
--  admin_purge_content faisaient des DELETE sans WHERE. On ajoute « where true »
--  (efface bien tout, mais avec une clause valide).
--
--  À exécuter dans le SQL Editor de Supabase (après 0030).
-- ============================================================================

-- Bannière d'annonce : pose (Grand Mestre uniquement).
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

  delete from public.announcements where true;
  insert into public.announcements (message, author_profile)
  values (trim(p_message), v_uid);
end;
$$;
grant execute on function public.set_announcement(text) to authenticated;

-- Réinitialisation totale du contenu (Grand Mestre).
create or replace function public.admin_purge_content()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_founder(auth.uid()) then
    raise exception 'Réservé au Grand Mestre.';
  end if;
  delete from public.post_comments    where true;
  delete from public.posts            where true;
  delete from public.raven_recipients where true;
  delete from public.ravens           where true;
  delete from public.archives         where true;
  delete from public.reports          where true;
end;
$$;

-- ============================================================================
--  Fin de la migration 0031.
-- ============================================================================
