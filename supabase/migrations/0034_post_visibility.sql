-- ============================================================================
--  CK3FR RP — Migration 0034 : posts publics ou privés (par royaume)
--
--  Un post de salon peut être PUBLIC (visible de tous, défaut) ou PRIVÉ. Un
--  post privé n'est visible que par les membres du MÊME royaume que le salon
--  (la région), plus son auteur et les Mestres. Vaut pour tous les royaumes.
--
--  À exécuter dans le SQL Editor de Supabase (après 0033).
-- ============================================================================

alter table public.posts add column if not exists is_private boolean not null default false;

-- Le post est-il visible par le joueur courant ? (helper pour les commentaires)
create or replace function public.post_visible(p_post uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not p.is_private
      or p.author_profile = auth.uid()
      or public.is_admin(auth.uid())
      or public.house_region(public.current_house()) = p.channel
  from public.posts p where p.id = p_post;
$$;

-- Lecture des posts : tout le monde voit les publics ; les privés seulement
-- l'auteur, les Mestres et le royaume du salon.
drop policy if exists "posts_select" on public.posts;
create policy "posts_select" on public.posts
  for select to authenticated using (
    not is_private
    or author_profile = auth.uid()
    or public.is_admin(auth.uid())
    or public.house_region(public.current_house()) = channel
  );

-- Les commentaires suivent la visibilité de leur post.
drop policy if exists "post_comments_select" on public.post_comments;
create policy "post_comments_select" on public.post_comments
  for select to authenticated using (public.post_visible(post_id));

drop policy if exists "post_comments_insert" on public.post_comments;
create policy "post_comments_insert" on public.post_comments
  for insert to authenticated with check (
    author_profile = auth.uid()
    and not public.is_observer(auth.uid())
    and not public.is_muted(auth.uid())
    and public.post_visible(post_id)
  );

-- ============================================================================
--  Fin de la migration 0034.
-- ============================================================================
