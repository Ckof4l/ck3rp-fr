-- ============================================================================
--  CK3FR RP — Migration 0024 : Scrutins par royaume (votes scellés)
--
--  Chaque royaume (région) a ses propres scrutins. SEUL LE ROI du royaume peut
--  en ouvrir un, avec une date de clôture. Les membres du royaume votent (une
--  voix). Les autres royaumes VOIENT le scrutin mais ne peuvent pas y voter.
--  Les résultats restent SCELLÉS jusqu'à la clôture (compte à rebours), puis
--  se révèlent à tous.
--
--  À exécuter dans le SQL Editor de Supabase (après 0023).
-- ============================================================================

create table if not exists public.polls (
  id             uuid primary key default gen_random_uuid(),
  realm          text not null,                  -- clé de royaume (le-nord, …)
  title          text not null,
  description    text not null default '',
  author_profile uuid not null references public.profiles (id) on delete cascade,
  status         text not null default 'open',   -- 'open' | 'closed' (clôture anticipée)
  closes_at      timestamptz not null,           -- fin du compte à rebours
  created_at     timestamptz not null default now()
);
create index if not exists polls_created_idx on public.polls (created_at desc);

create table if not exists public.poll_options (
  id        uuid primary key default gen_random_uuid(),
  poll_id   uuid not null references public.polls (id) on delete cascade,
  label     text not null,
  position  int  not null default 0
);
create index if not exists poll_options_poll_idx on public.poll_options (poll_id);

create table if not exists public.poll_votes (
  poll_id    uuid not null references public.polls (id) on delete cascade,
  option_id  uuid not null references public.poll_options (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, profile_id)              -- un vote par joueur et par scrutin
);
create index if not exists poll_votes_poll_idx on public.poll_votes (poll_id);

-- Le scrutin accepte-t-il encore des votes ?
create or replace function public.poll_is_open(p_poll uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select status = 'open' and closes_at > now() from public.polls where id = p_poll;
$$;

-- Les résultats sont-ils révélés ? (clôture atteinte ou clôture anticipée)
create or replace function public.poll_revealed(p_poll uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select status = 'closed' or closes_at <= now() from public.polls where id = p_poll;
$$;

-- Le joueur courant peut-il voter à ce scrutin ? (de son royaume, ouvert, non-obs.)
create or replace function public.can_vote_poll(p_poll uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not coalesce(p.is_observer, false)
     and pl.status = 'open' and pl.closes_at > now()
     and public.house_region(p.house) = pl.realm
  from public.profiles p, public.polls pl
  where p.id = auth.uid() and pl.id = p_poll;
$$;

-- Ouverture d'un scrutin : seul le ROI, pour SON royaume, avec une clôture future.
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

alter table public.polls        enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes   enable row level security;

-- Lecture publique des scrutins & de leurs options (tous les royaumes).
create policy "polls_select"        on public.polls        for select to authenticated using (true);
create policy "poll_options_select" on public.poll_options for select to authenticated using (true);

-- polls : créés via RPC ; clôture/suppression par l'auteur ou un Mestre.
create policy "polls_update" on public.polls
  for update to authenticated
  using (author_profile = auth.uid() or public.is_admin(auth.uid()))
  with check (author_profile = auth.uid() or public.is_admin(auth.uid()));
-- Suppression réservée aux Mestres (un joueur ne retire pas ses propres traces).
create policy "polls_delete" on public.polls
  for delete to authenticated using (public.is_admin(auth.uid()));

-- poll_options : un Mestre peut corriger ; la création passe par le RPC.
create policy "poll_options_admin_write" on public.poll_options
  for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- poll_votes : on ne voit QUE son propre vote tant que les résultats ne sont pas
--              révélés (tallies scellés) ; après la clôture, tout devient visible.
create policy "poll_votes_select" on public.poll_votes
  for select to authenticated
  using (profile_id = auth.uid() or public.poll_revealed(poll_id));

-- poll_votes : un membre du royaume vote pour lui-même tant que c'est ouvert
--              (et peut changer son vote).
create policy "poll_votes_insert" on public.poll_votes
  for insert to authenticated with check (
    profile_id = auth.uid() and public.can_vote_poll(poll_id)
  );
create policy "poll_votes_update" on public.poll_votes
  for update to authenticated
  using (profile_id = auth.uid() and public.can_vote_poll(poll_id))
  with check (profile_id = auth.uid() and public.can_vote_poll(poll_id));

alter publication supabase_realtime add table public.polls;
alter publication supabase_realtime add table public.poll_options;
alter publication supabase_realtime add table public.poll_votes;

-- ============================================================================
--  Fin de la migration 0024.
-- ============================================================================
