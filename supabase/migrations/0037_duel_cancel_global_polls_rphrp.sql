-- ============================================================================
--  CK3FR RP — Migration 0037 : annuler un duel, scrutins « tous royaumes »,
--  étiquette RP/HRP (scrutins & posts), Mestres postent dans tout royaume.
--
--  À exécuter dans le SQL Editor de Supabase (après 0036).
-- ============================================================================

-- ── 1. Annuler un duel encore en attente (le provocateur seul) ──────────────
create or replace function public.cancel_duel(p_duel uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_chal uuid; v_status text;
begin
  select challenger, status into v_chal, v_status from public.duels where id = p_duel;
  if v_chal is null then raise exception 'Duel introuvable.'; end if;
  if v_uid <> v_chal then raise exception 'Seul le provocateur peut annuler.'; end if;
  if v_status <> 'pending' then raise exception 'Trop tard : ce duel est déjà tranché.'; end if;
  delete from public.duels where id = p_duel;
end;
$$;
grant execute on function public.cancel_duel(uuid) to authenticated;

-- ── 2 & 3. Scrutins : portée « tous royaumes » + étiquette RP/HRP ───────────
alter table public.polls add column if not exists is_global boolean not null default false;
alter table public.polls add column if not exists is_hrp    boolean not null default false;

-- Vote : un scrutin global est ouvert à tous (non-observateurs) ; sinon, royaume.
create or replace function public.can_vote_poll(p_poll uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not coalesce(p.is_observer, false)
     and pl.status = 'open' and pl.closes_at > now()
     and (pl.is_global or public.house_region(p.house) = pl.realm)
  from public.profiles p, public.polls pl
  where p.id = auth.uid() and pl.id = p_poll;
$$;

-- L'ancienne fonction (4 args) est remplacée par la version à 6 args.
drop function if exists public.create_poll(text, text, text[], timestamptz);

create or replace function public.create_poll(
  p_title text, p_description text, p_options text[], p_closes_at timestamptz,
  p_global boolean, p_hrp boolean
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_admin boolean; v_king boolean; v_realm text;
        v_poll uuid; v_label text; v_pos int := 0;
begin
  select is_admin, is_king, public.house_region(house) into v_admin, v_king, v_realm
    from public.profiles where id = v_uid;

  if coalesce(p_global, false) then
    if not coalesce(v_admin, false) then raise exception 'Seul un Mestre peut ouvrir un scrutin pour tous les royaumes.'; end if;
    v_realm := '*';
  else
    if not coalesce(v_king, false) then raise exception 'Seul le Roi peut ouvrir un scrutin de royaume.'; end if;
    if v_realm is null then raise exception 'Tu n''appartiens à aucun royaume.'; end if;
  end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Donne un titre au scrutin.'; end if;
  if coalesce(array_length(p_options, 1), 0) < 2 then raise exception 'Au moins deux choix sont requis.'; end if;
  if p_closes_at is null or p_closes_at <= now() then raise exception 'La clôture doit être dans le futur.'; end if;

  insert into public.polls (realm, title, description, author_profile, closes_at, is_global, is_hrp)
  values (v_realm, trim(p_title), trim(coalesce(p_description, '')), v_uid, p_closes_at,
          coalesce(p_global, false), coalesce(p_hrp, false))
  returning id into v_poll;

  foreach v_label in array p_options loop
    if coalesce(trim(v_label), '') <> '' then
      insert into public.poll_options (poll_id, label, position) values (v_poll, trim(v_label), v_pos);
      v_pos := v_pos + 1;
    end if;
  end loop;
  return v_poll;
end;
$$;
grant execute on function public.create_poll(text, text, text[], timestamptz, boolean, boolean) to authenticated;

-- ── 4. Posts : étiquette RP/HRP + les Mestres postent dans tout royaume ─────
alter table public.posts add column if not exists is_hrp boolean not null default false;

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
    return true;
  else
    -- Salons régionaux : sa région, OU n'importe lequel pour un Mestre.
    return public.house_region(v_house) = p_channel or coalesce(v_admin, false);
  end if;
end;
$$;

-- ============================================================================
--  Fin de la migration 0037.
-- ============================================================================
