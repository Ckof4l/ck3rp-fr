-- ============================================================================
--  CK3FR RP — Migration 0029 : décret noble réservé aux vassaux
--
--  Avant : décret noble = tout sauf les Rois (donc les Mestres aussi). Désormais
--  seuls les VASSAUX (ni Roi, ni Mestre, ni observateur) y écrivent. Le décret
--  royal reste aux Rois (+ Mestres). Plus personne ne poste dans les deux.
--
--  À exécuter dans le SQL Editor de Supabase (après 0028).
-- ============================================================================

create or replace function public.can_post_channel(p_uid uuid, p_channel text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_admin boolean; v_obs boolean; v_king boolean; v_house text; v_muted timestamptz;
begin
  select is_admin, is_observer, is_king, house, muted_until
    into v_admin, v_obs, v_king, v_house, v_muted
    from public.profiles where id = p_uid;

  if coalesce(v_obs, false) then return false; end if;                 -- observateur : lecture seule
  if v_muted is not null and v_muted > now() then return false; end if; -- réduit au silence

  if p_channel = 'decret-royal' then
    return coalesce(v_king, false) or coalesce(v_admin, false);        -- Rois (+ Mestres)
  elsif p_channel = 'decret-noble' then
    return not coalesce(v_king, false) and not coalesce(v_admin, false); -- vassaux UNIQUEMENT
  elsif p_channel = 'lore' then
    return coalesce(v_admin, false);                                   -- Grands Mestres
  elsif p_channel = 'rumeurs' then
    return true;                                                       -- ouvert à tous
  else
    return public.house_region(v_house) = p_channel;                  -- région de sa maison
  end if;
end;
$$;

-- ============================================================================
--  Fin de la migration 0029.
-- ============================================================================
