-- ============================================================================
--  CK3FR RP — Migration 0024 : Scrutins (votes des grands événements)
--
--  Un Mestre ouvre un scrutin (titre + choix) ; chaque joueur (non-observateur)
--  vote une fois ; les résultats sont publics et en temps réel. Le Mestre peut
--  clore le scrutin.
--
--  À exécuter dans le SQL Editor de Supabase (après 0023).
-- ============================================================================

create table if not exists public.polls (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text not null default '',
  author_profile uuid not null references public.profiles (id) on delete cascade,
  status         text not null default 'open',   -- 'open' | 'closed'
  created_at     timestamptz not null default now(),
  closed_at      timestamptz
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
  primary key (poll_id, profile_id)   -- un vote par joueur et par scrutin
);
create index if not exists poll_votes_poll_idx on public.poll_votes (poll_id);

-- Le scrutin est-il ouvert ? (SECURITY DEFINER → pas de récursion RLS)
create or replace function public.poll_is_open(p_poll uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select status = 'open' from public.polls where id = p_poll;
$$;

-- Création atomique d'un scrutin + ses choix (Mestre uniquement).
create or replace function public.create_poll(p_title text, p_description text, p_options text[])
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_poll uuid; v_label text; v_pos int := 0;
begin
  if not public.is_admin(v_uid) then raise exception 'Réservé aux Mestres.'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Donne un titre au scrutin.'; end if;
  if coalesce(array_length(p_options, 1), 0) < 2 then raise exception 'Au moins deux choix sont requis.'; end if;

  insert into public.polls (title, description, author_profile)
  values (trim(p_title), trim(coalesce(p_description, '')), v_uid)
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
grant execute on function public.create_poll(text, text, text[]) to authenticated;

alter table public.polls        enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes   enable row level security;

-- Lecture publique partout.
create policy "polls_select"        on public.polls        for select to authenticated using (true);
create policy "poll_options_select" on public.poll_options for select to authenticated using (true);
create policy "poll_votes_select"   on public.poll_votes   for select to authenticated using (true);

-- polls : créés via RPC ; clôture/édition/suppression par l'auteur ou un Mestre.
create policy "polls_update" on public.polls
  for update to authenticated
  using (author_profile = auth.uid() or public.is_admin(auth.uid()))
  with check (author_profile = auth.uid() or public.is_admin(auth.uid()));
create policy "polls_delete" on public.polls
  for delete to authenticated using (author_profile = auth.uid() or public.is_admin(auth.uid()));

-- poll_options : écrites via RPC ; un Mestre peut corriger/supprimer.
create policy "poll_options_admin_write" on public.poll_options
  for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- poll_votes : un joueur (non-observateur) vote pour lui-même, tant que le
--              scrutin est ouvert ; il peut changer son vote (update).
create policy "poll_votes_insert" on public.poll_votes
  for insert to authenticated with check (
    profile_id = auth.uid() and not public.is_observer(auth.uid()) and public.poll_is_open(poll_id)
  );
create policy "poll_votes_update" on public.poll_votes
  for update to authenticated
  using (profile_id = auth.uid() and public.poll_is_open(poll_id))
  with check (profile_id = auth.uid() and public.poll_is_open(poll_id));

alter publication supabase_realtime add table public.polls;
alter publication supabase_realtime add table public.poll_options;
alter publication supabase_realtime add table public.poll_votes;

-- ============================================================================
--  Fin de la migration 0024.
-- ============================================================================
