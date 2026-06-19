-- ============================================================================
--  CK3FR RP — Migration 0007 : suppression de compte (RGPD)
--
--  Permet à un joueur de supprimer définitivement son compte et toutes ses
--  données. La suppression de auth.users cascade vers profiles (FK on delete
--  cascade) et donc vers tout son contenu (posts, corbeaux, cimetière…) et
--  libère sa maison (house_claims cascade).
--
--  À exécuter dans le SQL Editor de Supabase (après 0006).
-- ============================================================================

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_my_account() to authenticated;

-- ============================================================================
--  Fin de la migration 0007.
-- ============================================================================
