-- ============================================================================
--  CK3FR RP — Migration 0035 : salon HRP (Hors-RP), ouvert à tous
--
--  Un salon de discussion hors-roleplay où tout joueur non-observateur (et non
--  réduit au silence) peut écrire — comme « rumeurs », mais pour l'organisation,
--  les questions, le papotage OOC.
--
--  À exécuter dans le SQL Editor de Supabase (après 0034).
-- ============================================================================

create or replace function public.can_post_channel(p_uid uuid, p_channel text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_admin boolean; v_obs boolean; v_king boolean; v_house text; v_muted timestamptz;
begin
  select is_admin, is_observer, is_king, house, muted_until
    into v_admin, v_obs, v_king, v_house, v_muted
    from public.profiles where id = p_uid;

  if coalesce(v_obs, false) then return false; end if;
  if v_muted is not null and v_muted > now() then return false; end if;

  if p_channel = 'decret-royal' then
    return coalesce(v_king, false) or coalesce(v_admin, false);
  elsif p_channel = 'decret-noble' then
    return not coalesce(v_king, false) and not coalesce(v_admin, false);
  elsif p_channel = 'lore' then
    return coalesce(v_admin, false);
  elsif p_channel = 'rumeurs' or p_channel = 'hrp' then
    return true;                                  -- ouverts à tous
  else
    return public.house_region(v_house) = p_channel;
  end if;
end;
$$;

-- ============================================================================
--  Fin de la migration 0035.
-- ============================================================================
