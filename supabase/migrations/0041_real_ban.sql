-- ============================================================================
--  CK3FR RP — Migration 0041 : vrai bannissement (blocage du compte Discord)
--
--  Jusqu'ici « Bannir » ne supprimait que le profil : à la reconnexion Discord,
--  ensure_profile() recréait un profil vierge → le « banni » revenait en
--  Nouveau venu. Ce n'était donc qu'un RESET, pas un ban.
--
--  Désormais :
--   • « Bannir » (ban_user_hard) = BLOCAGE PERMANENT, indexé sur l'identité
--     Discord (user_id), qui SURVIT à la suppression du profil. Le banni ne peut
--     plus recréer de profil ni se réinscrire tant qu'il n'est pas débanni.
--   • « Exclure » garde l'ancien comportement (ban_profile = reset/re-onboarding,
--     le joueur peut revenir). Voir migration 0038 — inchangée.
--   • « Débannir » (unban_user) = on retire le blocage → le joueur peut revenir.
--
--  À exécuter dans le SQL Editor de Supabase (après 0040).
-- ============================================================================

-- Registre des comptes bannis. La clé est l'user_id Discord (= profiles.id),
-- pas un profil : il subsiste même quand le profil est supprimé. On y fige un
-- instantané d'identité (nom + Discord) pour que la liste reste lisible.
create table if not exists public.banned_users (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  character_name text,
  discord        text,
  reason         text,
  banned_by      uuid references public.profiles (id) on delete set null,
  banned_at      timestamptz not null default now()
);

alter table public.banned_users enable row level security;

-- Helper (SECURITY DEFINER → utilisable dans ensure_profile sans récursion RLS).
create or replace function public.is_banned(p_uid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.banned_users where user_id = p_uid);
$$;

-- Lecture : un joueur voit SA propre ligne de ban (pour l'écran « banni ») ;
-- les Mestres voient toute la liste. Écriture uniquement via RPC (definer).
drop policy if exists "banned_select_self_or_admin" on public.banned_users;
create policy "banned_select_self_or_admin" on public.banned_users
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- ── Bannissement dur : fige l'identité, pose le blocage, supprime le profil ──
create or replace function public.ban_user_hard(p_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_caller_admin   boolean;
  v_caller_founder boolean;
  v_name           text;
  v_discord        text;
  v_target_admin   boolean;
  v_target_founder boolean;
begin
  select is_admin, is_founder into v_caller_admin, v_caller_founder
    from public.profiles where id = auth.uid();
  if not coalesce(v_caller_admin, false) then
    raise exception 'Réservé aux Mestres.';
  end if;

  select character_name, discord, is_admin, is_founder
    into v_name, v_discord, v_target_admin, v_target_founder
    from public.profiles where id = p_id;
  if not found then raise exception 'Profil introuvable.'; end if;

  -- Même hiérarchie que l'exclusion (0038).
  if coalesce(v_target_founder, false) then
    raise exception 'Un Grand Mestre ne peut pas être banni.';
  end if;
  if coalesce(v_target_admin, false) and not coalesce(v_caller_founder, false) then
    raise exception 'Seul un Grand Mestre peut bannir un Mestre.';
  end if;

  insert into public.banned_users (user_id, character_name, discord, reason, banned_by)
  values (p_id, v_name, v_discord, nullif(trim(coalesce(p_reason, '')), ''), auth.uid())
  on conflict (user_id) do update
    set character_name = excluded.character_name,
        discord        = excluded.discord,
        reason         = excluded.reason,
        banned_by      = excluded.banned_by,
        banned_at      = now();

  delete from public.profiles where id = p_id;
end;
$$;
grant execute on function public.ban_user_hard(uuid, text) to authenticated;

-- ── Débannissement : retire le blocage (le joueur peut revenir / se réinscrire) ──
create or replace function public.unban_user(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Réservé aux Mestres.';
  end if;
  delete from public.banned_users where user_id = p_id;
end;
$$;
grant execute on function public.unban_user(uuid) to authenticated;

-- ── Garde : ne JAMAIS recréer de profil pour un compte banni ──
create or replace function public.ensure_profile()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_meta jsonb;
  v_username text;
  v_discord  text;
  v_first    boolean;
begin
  if v_uid is null then return; end if;
  if public.is_banned(v_uid) then return; end if;       -- banni : pas de retour
  if exists (select 1 from public.profiles where id = v_uid) then return; end if;

  select raw_user_meta_data into v_meta from auth.users where id = v_uid;

  v_username := lower(regexp_replace(coalesce(v_meta ->> 'username', ''), '\s+', '', 'g'));
  if v_username = '' then v_username := 'mestre_' || left(v_uid::text, 8); end if;
  if exists (select 1 from public.profiles where username = v_username) then
    v_username := v_username || '_' || left(v_uid::text, 4);
  end if;

  v_discord := nullif(trim(coalesce(
                 v_meta ->> 'discord', v_meta ->> 'preferred_username',
                 v_meta ->> 'full_name', v_meta ->> 'name', '')), '');
  v_first := not exists (select 1 from public.profiles);

  insert into public.profiles (id, username, character_name, house, discord, is_admin, is_observer, is_founder, onboarded)
  values (v_uid, v_username, 'Nouveau venu', 'autre', v_discord, v_first, false, v_first, false);
end;
$$;
grant execute on function public.ensure_profile() to authenticated;

-- ============================================================================
--  Fin de la migration 0041.
-- ============================================================================
