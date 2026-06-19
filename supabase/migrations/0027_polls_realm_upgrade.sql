-- ============================================================================
--  CK3FR RP — Migration 0027 : mise à niveau des Scrutins vers le modèle
--  « par royaume + compte à rebours ».
--
--  L'ancienne table polls (sans realm/closes_at) est mise à niveau. ⚠️ Les
--  scrutins de TEST de l'ancien modèle sont effacés (ils n'ont pas de royaume
--  ni de date de clôture). Tu les recréeras avec le nouveau système.
--
--  À exécuter dans le SQL Editor de Supabase (après 0026).
-- ============================================================================

-- Efface les anciens scrutins (cascade vers options & votes) pour pouvoir
-- imposer les nouvelles colonnes NOT NULL.
delete from public.polls;

alter table public.polls add column if not exists realm     text;
alter table public.polls add column if not exists closes_at timestamptz;
alter table public.polls alter column realm     set not null;
alter table public.polls alter column closes_at set not null;

-- L'ancienne fonction (3 arguments, Mestre) est remplacée par la version Roi.
drop function if exists public.create_poll(text, text, text[]);

create or replace function public.poll_is_open(p_poll uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select status = 'open' and closes_at > now() from public.polls where id = p_poll;
$$;

create or replace function public.poll_revealed(p_poll uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select status = 'closed' or closes_at <= now() from public.polls where id = p_poll;
$$;

create or replace function public.can_vote_poll(p_poll uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not coalesce(p.is_observer, false)
     and pl.status = 'open' and pl.closes_at > now()
     and public.house_region(p.house) = pl.realm
  from public.profiles p, public.polls pl
  where p.id = auth.uid() and pl.id = p_poll;
$$;

create or replace function public.create_poll(
  p_title text, p_description text, p_options text[], p_closes_at timestamptz
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_king boolean; v_realm text; v_poll uuid; v_label text; v_pos int := 0;
begin
  select is_king, public.house_region(house) into v_king, v_realm
    from public.profiles where id = v_uid;
  if not coalesce(v_king, false) then raise exception 'Seul le Roi peut ouvrir un scrutin.'; end if;
  if v_realm is null then raise exception 'Tu n''appartiens à aucun royaume.'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Donne un titre au scrutin.'; end if;
  if coalesce(array_length(p_options, 1), 0) < 2 then raise exception 'Au moins deux choix sont requis.'; end if;
  if p_closes_at is null or p_closes_at <= now() then raise exception 'La clôture doit être dans le futur.'; end if;

  insert into public.polls (realm, title, description, author_profile, closes_at)
  values (v_realm, trim(p_title), trim(coalesce(p_description, '')), v_uid, p_closes_at)
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
grant execute on function public.create_poll(text, text, text[], timestamptz) to authenticated;

-- RLS : on ne voit que son propre vote tant que ce n'est pas révélé ; on ne
-- vote que dans son royaume tant que c'est ouvert ; suppression Mestre.
drop policy if exists "poll_votes_select" on public.poll_votes;
create policy "poll_votes_select" on public.poll_votes
  for select to authenticated
  using (profile_id = auth.uid() or public.poll_revealed(poll_id));

drop policy if exists "poll_votes_insert" on public.poll_votes;
create policy "poll_votes_insert" on public.poll_votes
  for insert to authenticated with check (
    profile_id = auth.uid() and public.can_vote_poll(poll_id)
  );

drop policy if exists "poll_votes_update" on public.poll_votes;
create policy "poll_votes_update" on public.poll_votes
  for update to authenticated
  using (profile_id = auth.uid() and public.can_vote_poll(poll_id))
  with check (profile_id = auth.uid() and public.can_vote_poll(poll_id));

drop policy if exists "polls_delete" on public.polls;
create policy "polls_delete" on public.polls
  for delete to authenticated using (public.is_admin(auth.uid()));

-- ============================================================================
--  Fin de la migration 0027.
-- ============================================================================
