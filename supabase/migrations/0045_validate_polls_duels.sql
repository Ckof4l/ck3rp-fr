-- ============================================================================
--  CK3FR RP — Migration 0045 : validation des Mestres pour Scrutins & Le Sort
--
--  Comme les alliances : un Roi qui ouvre un scrutin et un joueur qui lance un
--  duel passent désormais par une VALIDATION d'un Mestre avant que ça ne devienne
--  actif. Un Mestre qui crée lui-même est auto-validé.
--
--  Scrutins : nouvel état 'pending' (avant 'open'). validate_poll(accept) le passe
--            à 'open' (ou 'refused'). Un scrutin en attente est caché aux autres
--            joueurs (seuls l'auteur + les Mestres le voient).
--  Duels    : nouvel état 'awaiting' (avant 'pending'/réponse de l'adversaire).
--            validate_duel(accept) le passe à 'pending' (ou 'declined'). Un duel
--            en attente est caché à l'adversaire jusqu'à validation.
--
--  À exécuter dans le SQL Editor de Supabase (après 0044).
-- ============================================================================

-- ── SCRUTINS ────────────────────────────────────────────────────────────────

-- Création : 'pending' pour un Roi, 'open' direct pour un Mestre.
create or replace function public.create_poll(
  p_title text, p_description text, p_options text[], p_closes_at timestamptz,
  p_global boolean, p_hrp boolean
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_admin boolean; v_king boolean; v_realm text;
        v_poll uuid; v_label text; v_pos int := 0; v_status text;
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

  -- Un Mestre est auto-validé ; un Roi attend la validation d'un Mestre.
  v_status := case when coalesce(v_admin, false) then 'open' else 'pending' end;

  insert into public.polls (realm, title, description, author_profile, closes_at, is_global, is_hrp, status)
  values (v_realm, trim(p_title), trim(coalesce(p_description, '')), v_uid, p_closes_at,
          coalesce(p_global, false), coalesce(p_hrp, false), v_status)
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

-- Validation d'un scrutin par un Mestre.
create or replace function public.validate_poll(p_poll uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Réservé aux Mestres.'; end if;
  update public.polls
     set status = case when p_accept then 'open' else 'refused' end
   where id = p_poll and status = 'pending';
  if not found then raise exception 'Scrutin introuvable ou déjà traité.'; end if;
end;
$$;
grant execute on function public.validate_poll(uuid, boolean) to authenticated;

-- Un scrutin en attente / refusé ne révèle jamais de résultats.
create or replace function public.poll_revealed(p_poll uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select status = 'closed' or (status = 'open' and closes_at <= now())
  from public.polls where id = p_poll;
$$;

-- Visibilité : un scrutin en attente/refusé n'est vu que de son auteur + Mestres.
drop policy if exists "polls_select" on public.polls;
create policy "polls_select" on public.polls
  for select to authenticated using (
    status in ('open', 'closed')
    or author_profile = auth.uid()
    or public.is_admin(auth.uid())
  );

-- ── LE SORT (duels) ─────────────────────────────────────────────────────────

-- Création : 'awaiting' (validation Mestre) pour un joueur, 'pending' pour un Mestre.
create or replace function public.create_duel(p_opponent uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_duel uuid; v_admin boolean; v_status text;
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  if public.is_observer(v_uid) then raise exception 'Un observateur ne peut pas défier.'; end if;
  if p_opponent = v_uid then raise exception 'On ne se défie pas soi-même.'; end if;
  if not exists (select 1 from public.profiles where id = p_opponent) then
    raise exception 'Adversaire introuvable.';
  end if;

  select is_admin into v_admin from public.profiles where id = v_uid;
  v_status := case when coalesce(v_admin, false) then 'pending' else 'awaiting' end;

  insert into public.duels (challenger, opponent, reason, status)
  values (v_uid, p_opponent, nullif(trim(coalesce(p_reason, '')), ''), v_status)
  returning id into v_duel;
  return v_duel;
end;
$$;
grant execute on function public.create_duel(uuid, text) to authenticated;

-- Validation d'un duel par un Mestre (→ l'adversaire peut alors répondre).
create or replace function public.validate_duel(p_duel uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Réservé aux Mestres.'; end if;
  update public.duels
     set status      = case when p_accept then 'pending' else 'declined' end,
         resolved_at = case when p_accept then null else now() end
   where id = p_duel and status = 'awaiting';
  if not found then raise exception 'Duel introuvable ou déjà validé.'; end if;
end;
$$;
grant execute on function public.validate_duel(uuid, boolean) to authenticated;

-- Annulation par le provocateur : possible tant que non tranché (awaiting/pending).
create or replace function public.cancel_duel(p_duel uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_chal uuid; v_status text;
begin
  select challenger, status into v_chal, v_status from public.duels where id = p_duel;
  if v_chal is null then raise exception 'Duel introuvable.'; end if;
  if v_uid <> v_chal then raise exception 'Seul le provocateur peut annuler.'; end if;
  if v_status not in ('awaiting', 'pending') then raise exception 'Trop tard : ce duel est déjà tranché.'; end if;
  delete from public.duels where id = p_duel;
end;
$$;
grant execute on function public.cancel_duel(uuid) to authenticated;

-- Visibilité : un duel en attente de validation n'est vu que du provocateur + Mestres.
drop policy if exists "duels_select" on public.duels;
create policy "duels_select" on public.duels
  for select to authenticated using (
    status <> 'awaiting'
    or challenger = auth.uid()
    or public.is_admin(auth.uid())
  );

-- ============================================================================
--  Fin de la migration 0045.
-- ============================================================================
