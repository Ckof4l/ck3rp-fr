-- ============================================================================
--  CK3FR RP — Migration 0006 : rôle « Grand Mestre » (le fondateur)
--
--  Hiérarchie : Grand Mestre (fondateur, is_founder) › Mestre (is_admin) ›
--  Roi / Vassal / Observateur. Le Grand Mestre a tous les droits du Mestre,
--  PLUS la réinitialisation totale et la nomination d'autres Grands Mestres.
--
--  À exécuter dans le SQL Editor de Supabase (après 0005).
-- ============================================================================

-- ── Colonne ─────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists is_founder boolean not null default false;

-- Le fondateur = le tout premier inscrit (qui était déjà admin).
update public.profiles
  set is_founder = true
  where id = (select id from public.profiles order by created_at asc limit 1);

-- ── Helper ──────────────────────────────────────────────────────────────────
create or replace function public.is_founder(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_founder from public.profiles where id = uid), false);
$$;

-- ── Le 1er inscrit devient Grand Mestre (utile après une réinitialisation) ──
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

  insert into public.profiles (id, username, character_name, house, is_admin, is_observer, is_founder)
  values (new.id, v_username, v_character, v_house, v_is_admin, v_is_obs, v_first);

  if v_house is not null and v_house <> 'autre' then
    insert into public.house_claims (house_key, profile_id)
    values (v_house, new.id);
  end if;

  return new;
end;
$$;

-- ── Garde-fou : is_founder modifiable seulement par un Grand Mestre ─────────
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.is_founder is distinct from old.is_founder)
     and not public.is_founder(auth.uid()) then
    raise exception 'Seul un Grand Mestre peut nommer un Grand Mestre.';
  end if;
  if (new.is_admin    is distinct from old.is_admin
      or new.is_observer is distinct from old.is_observer
      or new.is_king     is distinct from old.is_king)
     and not public.is_admin(auth.uid()) then
    raise exception 'Modification des rôles réservée aux Mestres.';
  end if;
  return new;
end;
$$;

-- ── Réinitialisation TOTALE : réservée au Grand Mestre (fondateur) ──────────
create or replace function public.admin_purge_content()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_founder(auth.uid()) then
    raise exception 'Réservé au Grand Mestre.';
  end if;
  delete from public.post_comments;
  delete from public.posts;
  delete from public.raven_recipients;
  delete from public.ravens;
  delete from public.archives;
  delete from public.reports;
end;
$$;

-- ============================================================================
--  Fin de la migration 0006.
-- ============================================================================
