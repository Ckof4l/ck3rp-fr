-- ============================================================================
--  0039 — Les grandes familles régnantes deviennent Rois à l'inscription.
--
--  Quand un joueur s'inscrit avec l'une des 8 maisons qui règnent sur une
--  grande région (Stark, Arryn, Lannister, Durrandon, Jardinier, Martell,
--  Greyjoy, Targaryen), il est automatiquement nommé Roi (is_king = true).
--  Toute autre maison : is_king = false.
--
--  Mis côté serveur (SECURITY DEFINER) : impossible à forcer depuis le client.
-- ============================================================================

create or replace function public.complete_onboarding(p_character text, p_house text, p_discord text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_king boolean;
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  if coalesce(trim(p_character), '') = '' then raise exception 'Choisis un nom de personnage.'; end if;

  if p_house <> 'autre' and exists (
    select 1 from public.house_claims where house_key = p_house and profile_id <> v_uid
  ) then
    raise exception 'Cette maison est déjà tenue par un autre joueur.';
  end if;

  -- Grandes familles régnantes -> Roi automatique.
  v_king := p_house = any (array[
    'stark', 'arryn', 'lannister', 'durrandon', 'jardinier', 'martell', 'greyjoy', 'targaryen'
  ]);

  update public.profiles
     set character_name = trim(p_character),
         house          = p_house,
         discord        = nullif(trim(coalesce(p_discord, '')), ''),
         reborn_at      = now(),
         onboarded      = true,
         is_king        = v_king
   where id = v_uid;

  delete from public.house_claims where profile_id = v_uid;
  if p_house <> 'autre' then
    insert into public.house_claims (house_key, profile_id) values (p_house, v_uid);
  end if;
end;
$$;

grant execute on function public.complete_onboarding(text, text, text) to authenticated;

-- ============================================================================
--  Fin de la migration 0039.
-- ============================================================================
