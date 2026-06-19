-- ============================================================================
--  CK3FR RP — Schéma initial « La Volière »
--  Postgres / Supabase : tables, Row Level Security, triggers, RPC, Storage,
--  Realtime. À exécuter dans le SQL Editor de Supabase (ou via la CLI).
--
--  Note de nommage : la colonne « personnage » s'appelle `character_name`.
--  (`character` est un mot réservé SQL — on évite le guillemetage partout.)
-- ============================================================================

-- ── Types énumérés ──────────────────────────────────────────────────────────
create type public.raven_scope   as enum ('user', 'house', 'realm');
create type public.report_target as enum ('raven', 'proclamation', 'comment');

-- ── Codes d'accès & configuration (privé : jamais exposé au client) ─────────
create table public.app_config (
  key   text primary key,
  value text not null
);

-- ⚠️  CHANGE CES CODES après le premier déploiement.
insert into public.app_config (key, value) values
  ('code_citadelle',   'nicZhen'),       -- promeut Grand Mestre (admin)
  ('code_observateur', 'OBSERVATEUR');   -- rôle observateur (lecture seule)

-- ============================================================================
--  TABLES
-- ============================================================================

-- profiles : un profil par utilisateur Auth (id = auth.users.id)
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  username       text unique not null,
  character_name text not null,
  house          text not null default 'autre',
  is_admin       boolean not null default false,
  is_observer    boolean not null default false,
  reborn_at      timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

-- house_claims : une maison (sauf « autre ») tenue par un seul joueur
create table public.house_claims (
  house_key  text primary key,
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  claimed_at timestamptz not null default now()
);

-- ravens : corbeaux (direct / maison / royaume), regroupés en fils (thread_id)
create table public.ravens (
  id           uuid primary key default gen_random_uuid(),
  thread_id    uuid not null default gen_random_uuid(),
  from_profile uuid not null references public.profiles (id) on delete cascade,
  scope        public.raven_scope not null default 'user',
  to_scope     text,            -- clé de maison si scope='house', sinon null
  subject      text,
  body         text not null default '',
  image_path   text,            -- chemin dans le bucket Storage (jamais l'image)
  sent_at      timestamptz not null default now()
);
create index ravens_thread_idx on public.ravens (thread_id);
create index ravens_from_idx   on public.ravens (from_profile);

-- raven_recipients : destinataires d'un corbeau + statut « lu » par personne
create table public.raven_recipients (
  raven_id   uuid not null references public.ravens (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  read_at    timestamptz,       -- null = non lu
  primary key (raven_id, profile_id)
);
create index raven_recipients_profile_idx on public.raven_recipients (profile_id);

-- proclamations : la gazette publique
create table public.proclamations (
  id             uuid primary key default gen_random_uuid(),
  author_profile uuid not null references public.profiles (id) on delete cascade,
  title          text not null,
  body           text not null default '',
  image_path     text,
  created_at     timestamptz not null default now()
);
create index proclamations_created_idx on public.proclamations (created_at desc);

-- comments : commentaires sous une proclamation
create table public.comments (
  id              uuid primary key default gen_random_uuid(),
  proclamation_id uuid not null references public.proclamations (id) on delete cascade,
  author_profile  uuid not null references public.profiles (id) on delete cascade,
  text            text not null,
  created_at      timestamptz not null default now()
);
create index comments_proclamation_idx on public.comments (proclamation_id);

-- graveyard : nécrologie du royaume (personnages tombés)
create table public.graveyard (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  character_name text not null,
  house          text not null,
  cause          text,
  died_at        timestamptz not null default now()
);
create index graveyard_died_idx on public.graveyard (died_at desc);

-- archives : archivage personnel des fils de discussion
create table public.archives (
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  thread_id   uuid not null,
  archived_at timestamptz not null default now(),
  primary key (profile_id, thread_id)
);

-- reports : signalements (modération)
create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_profile uuid not null references public.profiles (id) on delete cascade,
  target_type      public.report_target not null,
  target_id        uuid not null,
  reason           text not null default '',
  created_at       timestamptz not null default now(),
  resolved         boolean not null default false
);
create index reports_open_idx on public.reports (resolved, created_at desc);

-- ============================================================================
--  FONCTIONS UTILITAIRES (SECURITY DEFINER — contournent RLS sans récursion)
-- ============================================================================

-- Vrai si l'utilisateur donné est administrateur.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = uid), false);
$$;

-- Liste publique des maisons revendiquées (pour griser le sélecteur à l'inscription).
create or replace function public.taken_houses()
returns table (house_key text, character_name text)
language sql
stable
security definer
set search_path = public
as $$
  select hc.house_key, p.character_name
  from public.house_claims hc
  join public.profiles p on p.id = hc.profile_id;
$$;
grant execute on function public.taken_houses() to anon, authenticated;

-- Appartenance à une lettre — fonctions SECURITY DEFINER pour éviter la
-- récursion entre les politiques RLS de `ravens` et `raven_recipients`.
create or replace function public.is_raven_recipient(p_raven uuid, p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.raven_recipients rr
    where rr.raven_id = p_raven and rr.profile_id = p_uid
  );
$$;

create or replace function public.is_raven_sender(p_raven uuid, p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ravens r
    where r.id = p_raven and r.from_profile = p_uid
  );
$$;

-- ============================================================================
--  CRÉATION DU PROFIL À L'INSCRIPTION
--  Trigger sur auth.users : lit les métadonnées du serment, crée le profil et
--  revendique la maison de façon atomique (l'unicité fait échouer l'inscription
--  si l'identifiant ou la maison est déjà pris).
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username  text := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '\s+', '', 'g'));
  v_character text := coalesce(new.raw_user_meta_data ->> 'character_name', 'Inconnu');
  v_house     text := coalesce(new.raw_user_meta_data ->> 'house', 'autre');
  v_code      text := coalesce(new.raw_user_meta_data ->> 'access_code', '');
  v_first     boolean := not exists (select 1 from public.profiles);
  v_code_admin text := (select value from public.app_config where key = 'code_citadelle');
  v_code_obs   text := (select value from public.app_config where key = 'code_observateur');
  v_is_admin  boolean;
  v_is_obs    boolean;
begin
  if v_username = '' then
    v_username := 'mestre_' || left(new.id::text, 8);
  end if;

  v_is_obs   := (v_code <> '' and v_code = v_code_obs);
  v_is_admin := v_first or (v_code <> '' and v_code = v_code_admin);

  insert into public.profiles (id, username, character_name, house, is_admin, is_observer)
  values (new.id, v_username, v_character, v_house, v_is_admin, v_is_obs);

  if v_house is not null and v_house <> 'autre' then
    insert into public.house_claims (house_key, profile_id)
    values (v_house, new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Empêche un non-admin de s'auto-promouvoir en modifiant son profil.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.is_admin is distinct from old.is_admin
      or new.is_observer is distinct from old.is_observer)
     and not public.is_admin(auth.uid()) then
    raise exception 'Modification des rôles réservée aux Grands Mestres.';
  end if;
  return new;
end;
$$;

create trigger guard_profile_privileges_trg
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ============================================================================
--  ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles         enable row level security;
alter table public.house_claims     enable row level security;
alter table public.ravens           enable row level security;
alter table public.raven_recipients enable row level security;
alter table public.proclamations    enable row level security;
alter table public.comments         enable row level security;
alter table public.graveyard        enable row level security;
alter table public.archives         enable row level security;
alter table public.reports          enable row level security;
alter table public.app_config       enable row level security;
-- (app_config : aucune policy → invisible au client ; seul le code SECURITY DEFINER y accède.)

-- ── profiles ────────────────────────────────────────────────────────────────
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_self_or_admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin(auth.uid()))
  with check (id = auth.uid() or public.is_admin(auth.uid()));
create policy "profiles_delete_self_or_admin" on public.profiles
  for delete to authenticated
  using (id = auth.uid() or public.is_admin(auth.uid()));

-- ── house_claims ────────────────────────────────────────────────────────────
create policy "claims_select" on public.house_claims
  for select to authenticated using (true);
create policy "claims_admin_write" on public.house_claims
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ── ravens ──────────────────────────────────────────────────────────────────
create policy "ravens_select_party" on public.ravens
  for select to authenticated using (
    from_profile = auth.uid()
    or public.is_raven_recipient(id, auth.uid())
  );
create policy "ravens_insert_self" on public.ravens
  for insert to authenticated with check (from_profile = auth.uid());
create policy "ravens_delete_sender_or_admin" on public.ravens
  for delete to authenticated
  using (from_profile = auth.uid() or public.is_admin(auth.uid()));

-- ── raven_recipients ────────────────────────────────────────────────────────
create policy "recipients_select" on public.raven_recipients
  for select to authenticated using (
    profile_id = auth.uid()
    or public.is_raven_sender(raven_id, auth.uid())
  );
create policy "recipients_insert_by_sender" on public.raven_recipients
  for insert to authenticated with check (
    public.is_raven_sender(raven_id, auth.uid())
  );
-- Marquer « lu » : un destinataire ne met à jour que sa propre ligne.
create policy "recipients_update_own" on public.raven_recipients
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
create policy "recipients_delete_admin" on public.raven_recipients
  for delete to authenticated using (public.is_admin(auth.uid()));

-- ── proclamations ───────────────────────────────────────────────────────────
create policy "proclamations_select" on public.proclamations
  for select to authenticated using (true);
create policy "proclamations_insert_self" on public.proclamations
  for insert to authenticated with check (author_profile = auth.uid());
create policy "proclamations_update_author_or_admin" on public.proclamations
  for update to authenticated
  using (author_profile = auth.uid() or public.is_admin(auth.uid()))
  with check (author_profile = auth.uid() or public.is_admin(auth.uid()));
create policy "proclamations_delete_author_or_admin" on public.proclamations
  for delete to authenticated
  using (author_profile = auth.uid() or public.is_admin(auth.uid()));

-- ── comments ────────────────────────────────────────────────────────────────
create policy "comments_select" on public.comments
  for select to authenticated using (true);
create policy "comments_insert_self" on public.comments
  for insert to authenticated with check (author_profile = auth.uid());
create policy "comments_delete_author_or_admin" on public.comments
  for delete to authenticated
  using (author_profile = auth.uid() or public.is_admin(auth.uid()));

-- ── graveyard ───────────────────────────────────────────────────────────────
create policy "graveyard_select" on public.graveyard
  for select to authenticated using (true);
create policy "graveyard_insert_self" on public.graveyard
  for insert to authenticated with check (profile_id = auth.uid());
create policy "graveyard_delete_self_or_admin" on public.graveyard
  for delete to authenticated
  using (profile_id = auth.uid() or public.is_admin(auth.uid()));

-- ── archives ────────────────────────────────────────────────────────────────
create policy "archives_select_own" on public.archives
  for select to authenticated using (profile_id = auth.uid());
create policy "archives_insert_own" on public.archives
  for insert to authenticated with check (profile_id = auth.uid());
create policy "archives_delete_own" on public.archives
  for delete to authenticated using (profile_id = auth.uid());

-- ── reports ─────────────────────────────────────────────────────────────────
create policy "reports_insert_self" on public.reports
  for insert to authenticated with check (reporter_profile = auth.uid());
create policy "reports_select_admin" on public.reports
  for select to authenticated using (public.is_admin(auth.uid()));
create policy "reports_update_admin" on public.reports
  for update to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "reports_delete_admin" on public.reports
  for delete to authenticated using (public.is_admin(auth.uid()));

-- ============================================================================
--  STORAGE — bucket public « corbeaux » (on ne stocke que le chemin en base)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('corbeaux', 'corbeaux', true)
on conflict (id) do nothing;

create policy "corbeaux_read_public" on storage.objects
  for select using (bucket_id = 'corbeaux');
create policy "corbeaux_insert_auth" on storage.objects
  for insert to authenticated with check (bucket_id = 'corbeaux');
create policy "corbeaux_delete_owner_or_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'corbeaux' and (owner = auth.uid() or public.is_admin(auth.uid())));

-- ============================================================================
--  REALTIME — diffusion en direct des corbeaux et de la gazette
-- ============================================================================
alter publication supabase_realtime add table public.ravens;
alter publication supabase_realtime add table public.raven_recipients;
alter publication supabase_realtime add table public.proclamations;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.graveyard;

-- ============================================================================
--  Fin de la migration 0001.
-- ============================================================================
