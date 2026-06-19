-- ============================================================================
--  CK3FR RP — Migration 0009 : édition & épinglage des posts
--
--  - posts.pinned    : un post épinglé reste en tête du salon (décrets…).
--  - posts.updated_at / post_comments.updated_at : marque « modifié ».
--  - politique UPDATE sur post_comments (manquante) pour permettre l'édition.
--
--  À exécuter dans le SQL Editor de Supabase (après 0008).
-- ============================================================================

alter table public.posts          add column if not exists pinned boolean not null default false;
alter table public.posts          add column if not exists updated_at timestamptz;
alter table public.post_comments  add column if not exists updated_at timestamptz;

-- Édition d'un commentaire par son auteur (ou un admin).
drop policy if exists "post_comments_update_author_or_admin" on public.post_comments;
create policy "post_comments_update_author_or_admin" on public.post_comments
  for update to authenticated
  using (author_profile = auth.uid() or public.is_admin(auth.uid()))
  with check (author_profile = auth.uid() or public.is_admin(auth.uid()));

-- ============================================================================
--  Fin de la migration 0009.
-- ============================================================================
