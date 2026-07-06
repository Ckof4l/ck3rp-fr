-- ============================================================================
--  CK3FR RP — Migration 0051 : les maisons vassales des Terres de l'Orage
--
--  Dix maisons rejoignent l'Orage (Selmy, Torth, Swann, Dondarrion, Caron,
--  Estermont, Errol, Penrose, Grandison, Mertyns) : on les ajoute au mapping
--  house_region pour qu'elles puissent poster dans leur salon régional et
--  participer aux scrutins de royaume. Doit rester synchronisé avec
--  src/lib/houses.ts (le reste du mapping est inchangé depuis la 0049).
--
--  À exécuter dans le SQL Editor de Supabase (après 0050).
-- ============================================================================

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
    when 'baratheon' then 'terres-de-l-orage' when 'connington' then 'terres-de-l-orage'
    when 'selmy' then 'terres-de-l-orage' when 'torth' then 'terres-de-l-orage'
    when 'swann' then 'terres-de-l-orage' when 'dondarrion' then 'terres-de-l-orage'
    when 'caron' then 'terres-de-l-orage' when 'estermont' then 'terres-de-l-orage'
    when 'errol' then 'terres-de-l-orage' when 'penrose' then 'terres-de-l-orage'
    when 'grandison' then 'terres-de-l-orage' when 'mertyns' then 'terres-de-l-orage'
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

-- ============================================================================
--  Fin de la migration 0051.
-- ============================================================================
