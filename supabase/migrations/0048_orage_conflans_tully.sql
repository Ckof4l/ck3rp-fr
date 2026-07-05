-- ============================================================================
--  CK3FR RP — Migration 0048 : nouvelle époque — l'Orage et le Conflans
--
--  Le royaume « Le Trident » n'existe plus. Il est scindé en deux :
--    · « Les Terres de l'Orage » (Durrandon, Connington) — nouveau salon
--      régional `terres-de-l-orage`.
--    · « Le Conflans » (Tully — désormais maison régnante / Roi automatique —
--      Frey, Bracken, Blackwood, Mallister, Vance, Piper, Darry, Mooton,
--      Whent) — le salon GARDE sa clé technique `le-trident` (l'historique
--      des posts et des scrutins y pointe) ; seul son affichage change.
--
--  Corrige au passage un trou historique : les maisons mineures (Bolton,
--  Umber, Royce, Tyrell… ~50 maisons ajoutées après la migration 0004)
--  étaient ABSENTES de house_region → leurs joueurs ne pouvaient poster dans
--  aucun salon régional ni participer aux scrutins de royaume. Le mapping
--  ci-dessous couvre désormais TOUTES les maisons de src/lib/houses.ts.
--
--  Doit rester synchronisé avec le front :
--    · house_region ↔ House.region (src/lib/houses.ts) + clés de salons
--      (src/lib/channels.ts).
--    · complete_onboarding ↔ KING_HOUSES (src/lib/houses.ts).
--
--  Portée : n'affecte que les droits (RLS) et les NOUVELLES inscriptions.
--  Un joueur déjà inscrit en Tully n'est pas couronné rétroactivement — un
--  Mestre le coiffe à la main via la Citadelle.
--
--  À exécuter dans le SQL Editor de Supabase (après 0047).
-- ============================================================================

-- ── 1. Région d'appartenance d'une maison → clé de salon régional ──────────
create or replace function public.house_region(p_house text)
returns text
language sql
immutable
as $$
  select case p_house
    -- Le Nord
    when 'stark' then 'le-nord' when 'forestier' then 'le-nord' when 'manderly' then 'le-nord'
    when 'reed' then 'le-nord' when 'karstark' then 'le-nord' when 'bolton' then 'le-nord'
    when 'umber' then 'le-nord' when 'mormont' then 'le-nord' when 'glover' then 'le-nord'
    when 'hornwood' then 'le-nord' when 'cerwyn' then 'le-nord' when 'tallhart' then 'le-nord'
    when 'dustin' then 'le-nord'
    -- Les Terres de l'Orage
    when 'durrandon' then 'terres-de-l-orage' when 'connington' then 'terres-de-l-orage'
    -- Le Conflans (salon à clé historique `le-trident`)
    when 'tully' then 'le-trident' when 'frey' then 'le-trident' when 'bracken' then 'le-trident'
    when 'blackwood' then 'le-trident' when 'mallister' then 'le-trident' when 'vance' then 'le-trident'
    when 'piper' then 'le-trident' when 'darry' then 'le-trident' when 'mooton' then 'le-trident'
    when 'whent' then 'le-trident'
    -- Le Roc
    when 'lannister' then 'le-roc' when 'brax' then 'le-roc' when 'reyne' then 'le-roc'
    when 'lefford' then 'le-roc' when 'clegane' then 'le-roc' when 'marbrand' then 'le-roc'
    when 'crakehall' then 'le-roc' when 'westerling' then 'le-roc' when 'payne' then 'le-roc'
    when 'swyft' then 'le-roc'
    -- La Montagne et le Val
    when 'arryn' then 'le-val' when 'grafton' then 'le-val' when 'melcolm' then 'le-val'
    when 'hersy' then 'le-val' when 'royce' then 'le-val' when 'corbray' then 'le-val'
    when 'waynwood' then 'le-val' when 'hunter' then 'le-val' when 'redfort' then 'le-val'
    when 'belmore' then 'le-val'
    -- Le Bief
    when 'jardinier' then 'le-bief' when 'hightower' then 'le-bief' when 'redwyne' then 'le-bief'
    when 'rowan' then 'le-bief' when 'tyrell' then 'le-bief' when 'tarly' then 'le-bief'
    when 'florent' then 'le-bief' when 'oakheart' then 'le-bief' when 'fossoway' then 'le-bief'
    when 'caswell' then 'le-bief'
    -- Dorne
    when 'martell' then 'dorne' when 'dayne' then 'dorne' when 'noirmont' then 'dorne'
    when 'ferboy' then 'dorne' when 'yronwood' then 'dorne' when 'fowler' then 'dorne'
    when 'allyrion' then 'dorne' when 'jordayne' then 'dorne' when 'santagar' then 'dorne'
    when 'manwoody' then 'dorne' when 'uller' then 'dorne'
    -- Les Îles de Fer
    when 'chenu' then 'les-iles-de-fer' when 'greyjoy' then 'les-iles-de-fer'
    when 'harloi' then 'les-iles-de-fer' when 'botley' then 'les-iles-de-fer'
    when 'goodbrother' then 'les-iles-de-fer' when 'drumm' then 'les-iles-de-fer'
    when 'blacktyde' then 'les-iles-de-fer' when 'wynch' then 'les-iles-de-fer'
    -- Peyredragon
    when 'targaryen' then 'peyredragon' when 'velaryon' then 'peyredragon'
    when 'celtigar' then 'peyredragon' when 'sunglass' then 'peyredragon'
    when 'massey' then 'peyredragon' when 'rosby' then 'peyredragon'
    when 'stokeworth' then 'peyredragon' when 'darklyn' then 'peyredragon'
    -- « autre » et inconnues : sans allégeance
    else null
  end;
$$;

-- ── 2. Tully rejoint les maisons à Roi automatique ──────────────────────────
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
    'stark', 'arryn', 'lannister', 'durrandon', 'tully', 'jardinier', 'martell', 'chenu', 'targaryen'
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
--  Fin de la migration 0048.
-- ============================================================================
