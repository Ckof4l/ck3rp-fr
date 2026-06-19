-- ============================================================================
--  CK3FR RP — Migration 0016 : connexion Discord + écran d'accueil
--
--  La connexion se fait via Discord (OAuth). Comme ce login ne passe pas par
--  le formulaire d'inscription, le joueur arrive avec un profil incomplet
--  (onboarded = false) puis choisit son personnage et sa maison.
--
--  À exécuter dans le SQL Editor de Supabase (après 0015).
--  ⚠️ Pense à activer le provider Discord dans Authentication → Providers.
-- ============================================================================

alter table public.profiles add column if not exists onboarded boolean not null default true;

-- Création du profil : récupère le pseudo Discord depuis les métadonnées OAuth,
-- et marque le profil « à compléter » s'il n'a pas été créé via le formulaire.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username  text := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '\s+', '', 'g'));
  v_character text := coalesce(new.raw_user_meta_data ->> 'character_name', 'Nouveau venu');
  v_house     text := coalesce(new.raw_user_meta_data ->> 'house', 'autre');
  v_discord   text := nullif(trim(coalesce(
                  new.raw_user_meta_data ->> 'discord',
                  new.raw_user_meta_data ->> 'preferred_username',
                  new.raw_user_meta_data ->> 'full_name',
                  new.raw_user_meta_data ->> 'name', '')), '');
  v_first     boolean := not exists (select 1 from public.profiles);
  v_onboarded boolean := (new.raw_user_meta_data ? 'character_name');
begin
  if v_username = '' then
    v_username := 'mestre_' || left(new.id::text, 8);
  end if;

  insert into public.profiles (id, username, character_name, house, discord, is_admin, is_observer, is_founder, onboarded)
  values (new.id, v_username, v_character, v_house, v_discord, v_first, false, v_first, v_onboarded);

  if v_house is not null and v_house <> 'autre' then
    insert into public.house_claims (house_key, profile_id) values (v_house, new.id);
  end if;

  return new;
end;
$$;

-- Finalisation de l'inscription : choix du personnage et de la maison.
create or replace function public.complete_onboarding(p_character text, p_house text, p_discord text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  if coalesce(trim(p_character), '') = '' then raise exception 'Choisis un nom de personnage.'; end if;

  if p_house <> 'autre' and exists (
    select 1 from public.house_claims where house_key = p_house and profile_id <> v_uid
  ) then
    raise exception 'Cette maison est déjà tenue par un autre joueur.';
  end if;

  update public.profiles
     set character_name = trim(p_character),
         house          = p_house,
         discord        = nullif(trim(coalesce(p_discord, '')), ''),
         reborn_at      = now(),
         onboarded      = true
   where id = v_uid;

  delete from public.house_claims where profile_id = v_uid;
  if p_house <> 'autre' then
    insert into public.house_claims (house_key, profile_id) values (p_house, v_uid);
  end if;
end;
$$;
grant execute on function public.complete_onboarding(text, text, text) to authenticated;

-- ============================================================================
--  Fin de la migration 0016.
-- ============================================================================
