-- ============================================================================
--  CK3FR RP — Migration 0047 : Chenu, maison régnante des Îles de Fer
--
--  À l'époque RP, ce sont les CHENU (et non les Greyjoy) qui tiennent les Îles
--  de Fer. On remplace 'greyjoy' par 'chenu' dans la liste des grandes maisons
--  régnantes (Roi automatique à l'inscription). Doit rester synchronisé avec
--  KING_HOUSES côté front (src/lib/houses.ts).
--
--  Portée : n'affecte que les NOUVELLES inscriptions. Les joueurs déjà inscrits
--  en Greyjoy (Roi) ou en Chenu sont à ajuster à la main via la Citadelle
--  (un Mestre coiffe / décoiffe la couronne).
--
--  À exécuter dans le SQL Editor de Supabase (après 0046).
-- ============================================================================

create or replace function public.complete_onboarding(p_character text, p_house text, p_discord text)
returns void
language plpgsql security definer set search_path = public as $$
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

  v_king := p_house = any (array[
    'stark', 'arryn', 'lannister', 'durrandon', 'jardinier', 'martell', 'chenu', 'targaryen'
  ]);

  -- Autorise le garde-fou à accepter le passage Roi automatique (transaction-local).
  perform set_config('app.onboarding', '1', true);

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
--  Fin de la migration 0047.
-- ============================================================================
