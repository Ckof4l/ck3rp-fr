-- ============================================================================
--  CK3FR RP — Migration 0003 : les Salons (tout le RP, en miroir du Discord)
--
--  Ajoute le rôle « Roi » et un modèle générique de salons :
--    posts (fil d'actualité d'un salon) + post_comments (réponses).
--  Salons : décret-royal (rois), décret-noble (vassaux), régions & rumeurs
--  (tous), lore (Grands Mestres). Les clés de salon vivent côté front.
--
--  À exécuter dans le SQL Editor de Supabase (après 0001 et 0002).
-- ============================================================================

-- ── Rôle Roi ────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists is_king boolean not null default false;

-- ── Helpers de rôle (SECURITY DEFINER : contournent la RLS) ─────────────────
create or replace function public.is_king(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_king from public.profiles where id = uid), false);
$$;

create or replace function public.is_observer(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_observer from public.profiles where id = uid), false);
$$;

-- Droit de publier dans un salon donné, selon le rôle du joueur.
create or replace function public.can_post_channel(p_uid uuid, p_channel text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_admin boolean;
  v_obs   boolean;
  v_king  boolean;
begin
  select is_admin, is_observer, is_king
    into v_admin, v_obs, v_king
    from public.profiles where id = p_uid;

  if coalesce(v_obs, false) then
    return false;                              -- observateur : lecture seule
  end if;

  if p_channel = 'decret-royal' then
    return coalesce(v_king, false) or coalesce(v_admin, false);
  elsif p_channel = 'decret-noble' then
    return not coalesce(v_king, false);        -- réservé aux vassaux
  elsif p_channel = 'lore' then
    return coalesce(v_admin, false);           -- Grands Mestres
  else
    return true;                               -- régions, rumeurs, etc.
  end if;
end;
$$;

-- ── posts : un message dans un salon ────────────────────────────────────────
create table if not exists public.posts (
  id             uuid primary key default gen_random_uuid(),
  channel        text not null,
  author_profile uuid not null references public.profiles (id) on delete cascade,
  title          text,
  body           text not null default '',
  image_path     text,
  created_at     timestamptz not null default now()
);
create index if not exists posts_channel_idx on public.posts (channel, created_at desc);

-- ── post_comments : réponses sous un post ───────────────────────────────────
create table if not exists public.post_comments (
  id             uuid primary key default gen_random_uuid(),
  post_id        uuid not null references public.posts (id) on delete cascade,
  author_profile uuid not null references public.profiles (id) on delete cascade,
  body           text not null,
  created_at     timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.posts         enable row level security;
alter table public.post_comments enable row level security;

-- posts : tout utilisateur connecté lit ; publication selon le rôle/salon ;
--         édition/suppression par l'auteur ou un admin.
create policy "posts_select" on public.posts
  for select to authenticated using (true);
create policy "posts_insert" on public.posts
  for insert to authenticated with check (
    author_profile = auth.uid() and public.can_post_channel(auth.uid(), channel)
  );
create policy "posts_update_author_or_admin" on public.posts
  for update to authenticated
  using (author_profile = auth.uid() or public.is_admin(auth.uid()))
  with check (author_profile = auth.uid() or public.is_admin(auth.uid()));
create policy "posts_delete_author_or_admin" on public.posts
  for delete to authenticated
  using (author_profile = auth.uid() or public.is_admin(auth.uid()));

-- commentaires : lecture par tous ; écriture par tout non-observateur ;
--                suppression par l'auteur ou un admin.
create policy "post_comments_select" on public.post_comments
  for select to authenticated using (true);
create policy "post_comments_insert" on public.post_comments
  for insert to authenticated with check (
    author_profile = auth.uid() and not public.is_observer(auth.uid())
  );
create policy "post_comments_delete_author_or_admin" on public.post_comments
  for delete to authenticated
  using (author_profile = auth.uid() or public.is_admin(auth.uid()));

-- ── Realtime ────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.post_comments;

-- ── L'ancienne « Gazette » (proclamations/comments) est remplacée par les
--    salons décret-royal / décret-noble. On retire ces tables (vides). ───────
drop table if exists public.comments cascade;
drop table if exists public.proclamations cascade;

-- ============================================================================
--  Fin de la migration 0003.
-- ============================================================================
