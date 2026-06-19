-- ============================================================================
--  CK3FR RP — Migration 0013 : pseudo Discord à l'inscription
--
--  Ajoute profiles.discord et le récupère depuis les métadonnées du serment.
--
--  À exécuter dans le SQL Editor de Supabase (après 0012).
-- ============================================================================

alter table public.profiles add column if not exists discord text;

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
  v_discord   text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'discord', '')), '');
  v_first     boolean := not exists (select 1 from public.profiles);
begin
  if v_username = '' then
    v_username := 'mestre_' || left(new.id::text, 8);
  end if;

  insert into public.profiles (id, username, character_name, house, discord, is_admin, is_observer, is_founder)
  values (new.id, v_username, v_character, v_house, v_discord, v_first, false, v_first);

  if v_house is not null and v_house <> 'autre' then
    insert into public.house_claims (house_key, profile_id)
    values (v_house, new.id);
  end if;

  return new;
end;
$$;

-- ============================================================================
--  Fin de la migration 0013.
-- ============================================================================
