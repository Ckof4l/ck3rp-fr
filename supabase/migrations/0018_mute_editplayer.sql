-- ============================================================================
--  CK3FR RP — Migration 0018 : sourdine (timeout) + édition d'un joueur
--
--  - muted_until : un Mestre peut réduire un joueur au silence pour un temps
--    (il ne peut plus poster / commenter / envoyer de corbeau).
--  - admin_set_player : un Mestre renomme le personnage d'un joueur ou le
--    déplace de maison (revendication atomique).
--
--  À exécuter dans le SQL Editor de Supabase (après 0017).
-- ============================================================================

alter table public.profiles add column if not exists muted_until timestamptz;

-- Le joueur est-il réduit au silence ?
create or replace function public.is_muted(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select muted_until from public.profiles where id = uid), '-infinity'::timestamptz) > now();
$$;

-- ── Garde-fou : muted_until modifiable seulement par un Mestre ──────────────
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.is_founder is distinct from old.is_founder) and not public.is_founder(auth.uid()) then
    raise exception 'Seul un Grand Mestre peut nommer un Grand Mestre.';
  end if;
  if (new.is_admin    is distinct from old.is_admin
      or new.is_observer is distinct from old.is_observer
      or new.is_king     is distinct from old.is_king
      or new.muted_until is distinct from old.muted_until)
     and not public.is_admin(auth.uid()) then
    raise exception 'Action réservée aux Mestres.';
  end if;
  return new;
end;
$$;

-- ── Publier : interdit si réduit au silence ────────────────────────────────
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
    return not coalesce(v_king, false);
  elsif p_channel = 'lore' then
    return coalesce(v_admin, false);
  elsif p_channel = 'rumeurs' then
    return true;
  else
    return public.house_region(v_house) = p_channel;
  end if;
end;
$$;

-- Commentaires & corbeaux : interdits si réduit au silence.
drop policy if exists "post_comments_insert" on public.post_comments;
create policy "post_comments_insert" on public.post_comments
  for insert to authenticated with check (
    author_profile = auth.uid() and not public.is_observer(auth.uid()) and not public.is_muted(auth.uid())
  );

drop policy if exists "ravens_insert_self" on public.ravens;
create policy "ravens_insert_self" on public.ravens
  for insert to authenticated with check (
    from_profile = auth.uid() and not public.is_muted(auth.uid())
  );

-- ── Commandes Mestre : sourdine & édition d'un joueur ──────────────────────
create or replace function public.admin_mute(p_target uuid, p_minutes int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Réservé aux Mestres.'; end if;
  update public.profiles set muted_until = now() + make_interval(mins => p_minutes) where id = p_target;
end;
$$;
grant execute on function public.admin_mute(uuid, int) to authenticated;

create or replace function public.admin_unmute(p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Réservé aux Mestres.'; end if;
  update public.profiles set muted_until = null where id = p_target;
end;
$$;
grant execute on function public.admin_unmute(uuid) to authenticated;

create or replace function public.admin_set_player(p_target uuid, p_character text, p_house text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Réservé aux Mestres.'; end if;
  if coalesce(trim(p_character), '') = '' then raise exception 'Nom de personnage requis.'; end if;
  if p_house <> 'autre' and exists (
    select 1 from public.house_claims where house_key = p_house and profile_id <> p_target
  ) then
    raise exception 'Cette maison est déjà tenue.';
  end if;
  update public.profiles set character_name = trim(p_character), house = p_house where id = p_target;
  delete from public.house_claims where profile_id = p_target;
  if p_house <> 'autre' then
    insert into public.house_claims (house_key, profile_id) values (p_house, p_target);
  end if;
end;
$$;
grant execute on function public.admin_set_player(uuid, text, text) to authenticated;

-- ============================================================================
--  Fin de la migration 0018.
-- ============================================================================
