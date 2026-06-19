-- ============================================================================
--  CK3FR RP — Migration 0004 : verrouillage des salons régionaux
--
--  On ne peut publier que dans la région de SA maison (ex. un Forestier, du
--  Nord, n'écrit que dans « le-nord »). Tout le monde peut lire toutes les
--  régions. Rumeurs reste ouvert ; décrets et lore inchangés.
--
--  À exécuter dans le SQL Editor de Supabase (après 0003).
-- ============================================================================

-- Région d'appartenance d'une maison → clé de salon régional.
-- (Reflète le référentiel front src/lib/houses.ts ; données statiques de lore.)
create or replace function public.house_region(p_house text)
returns text
language sql
immutable
as $$
  select case p_house
    when 'stark' then 'le-nord' when 'forestier' then 'le-nord' when 'manderly' then 'le-nord'
    when 'reed' then 'le-nord' when 'karstark' then 'le-nord'
    when 'durrandon' then 'le-trident' when 'connington' then 'le-trident' when 'frey' then 'le-trident'
    when 'bracken' then 'le-trident' when 'tully' then 'le-trident'
    when 'lannister' then 'le-roc' when 'brax' then 'le-roc' when 'reyne' then 'le-roc' when 'lefford' then 'le-roc'
    when 'arryn' then 'le-val' when 'grafton' then 'le-val' when 'melcolm' then 'le-val' when 'hersy' then 'le-val'
    when 'jardinier' then 'le-bief' when 'hightower' then 'le-bief' when 'redwyne' then 'le-bief' when 'rowan' then 'le-bief'
    when 'martell' then 'dorne' when 'dayne' then 'dorne' when 'noirmont' then 'dorne' when 'ferboy' then 'dorne'
    when 'chenu' then 'les-iles-de-fer' when 'greyjoy' then 'les-iles-de-fer' when 'harloi' then 'les-iles-de-fer'
    when 'targaryen' then 'peyredragon' when 'velaryon' then 'peyredragon' when 'celtigar' then 'peyredragon'
    else null
  end;
$$;

-- Droit de publier, version verrouillée par région.
create or replace function public.can_post_channel(p_uid uuid, p_channel text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_admin boolean;
  v_obs   boolean;
  v_king  boolean;
  v_house text;
begin
  select is_admin, is_observer, is_king, house
    into v_admin, v_obs, v_king, v_house
    from public.profiles where id = p_uid;

  if coalesce(v_obs, false) then
    return false;                              -- observateur : lecture seule
  end if;

  if p_channel = 'decret-royal' then
    return coalesce(v_king, false) or coalesce(v_admin, false);
  elsif p_channel = 'decret-noble' then
    return not coalesce(v_king, false);        -- réservé aux vassaux
  elsif p_channel = 'lore' then
    return coalesce(v_admin, false);           -- Grands Mestres
  elsif p_channel = 'rumeurs' then
    return true;                               -- ouvert à tous
  else
    -- Salons régionaux : seulement la région de sa maison.
    return public.house_region(v_house) = p_channel;
  end if;
end;
$$;

-- ============================================================================
--  Fin de la migration 0004.
-- ============================================================================
