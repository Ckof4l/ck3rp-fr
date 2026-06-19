-- ============================================================================
--  CK3FR RP — Migration 0030 : recréation de profil à la reconnexion
--
--  Problème : « bannir » supprime le profil mais pas l'identité Discord. À la
--  reconnexion, le joueur a une session valide SANS profil (le trigger
--  handle_new_user ne se déclenche qu'à la 1ʳᵉ inscription) → l'app boucle sur
--  la Porte. ensure_profile() recrée un profil vierge (onboarding) si le joueur
--  connecté n'en a plus → il « recommence de zéro ».
--
--  À exécuter dans le SQL Editor de Supabase (après 0029).
-- ============================================================================

create or replace function public.ensure_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_meta jsonb;
  v_username text;
  v_discord  text;
  v_first    boolean;
begin
  if v_uid is null then return; end if;
  if exists (select 1 from public.profiles where id = v_uid) then return; end if;

  select raw_user_meta_data into v_meta from auth.users where id = v_uid;

  v_username := lower(regexp_replace(coalesce(v_meta ->> 'username', ''), '\s+', '', 'g'));
  if v_username = '' then v_username := 'mestre_' || left(v_uid::text, 8); end if;
  -- Évite une collision si le pseudo est déjà pris.
  if exists (select 1 from public.profiles where username = v_username) then
    v_username := v_username || '_' || left(v_uid::text, 4);
  end if;

  v_discord := nullif(trim(coalesce(
                 v_meta ->> 'discord', v_meta ->> 'preferred_username',
                 v_meta ->> 'full_name', v_meta ->> 'name', '')), '');
  v_first := not exists (select 1 from public.profiles);

  insert into public.profiles (id, username, character_name, house, discord, is_admin, is_observer, is_founder, onboarded)
  values (v_uid, v_username, 'Nouveau venu', 'autre', v_discord, v_first, false, v_first, false);
end;
$$;
grant execute on function public.ensure_profile() to authenticated;

-- ============================================================================
--  Fin de la migration 0030.
-- ============================================================================
