-- ============================================================================
--  CK3FR RP — Migration 0008 : plus de code à l'inscription
--
--  Les rôles ne s'obtiennent plus avec un « Code de la Citadelle » au moment
--  de prêter serment. Seul le 1er inscrit devient Grand Mestre (fondateur +
--  admin) ; tous les autres sont de simples joueurs. Les rôles (Mestre, Roi,
--  Observateur, Grand Mestre) se donnent ensuite UNIQUEMENT depuis la Citadelle.
--
--  À exécuter dans le SQL Editor de Supabase (après 0007).
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username  text := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '\s+', '', 'g'));
  v_character text := coalesce(new.raw_user_meta_data ->> 'character_name', 'Inconnu');
  v_house     text := coalesce(new.raw_user_meta_data ->> 'house', 'autre');
  v_first     boolean := not exists (select 1 from public.profiles);
begin
  if v_username = '' then
    v_username := 'mestre_' || left(new.id::text, 8);
  end if;

  -- Seul le tout premier inscrit est Grand Mestre (fondateur + admin).
  insert into public.profiles (id, username, character_name, house, is_admin, is_observer, is_founder)
  values (new.id, v_username, v_character, v_house, v_first, false, v_first);

  if v_house is not null and v_house <> 'autre' then
    insert into public.house_claims (house_key, profile_id)
    values (v_house, new.id);
  end if;

  return new;
end;
$$;

-- La table des codes n'a plus de raison d'être.
drop table if exists public.app_config cascade;

-- ============================================================================
--  Fin de la migration 0008.
-- ============================================================================
