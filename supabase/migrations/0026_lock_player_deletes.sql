-- ============================================================================
--  CK3FR RP — Migration 0026 : l'archive des joueurs devient immuable
--
--  Un joueur ne peut plus retirer ses propres traces : seuls les Mestres
--  suppriment (modération). Concerne posts, commentaires, lettres (corbeaux),
--  pactes, requêtes et cimetière. (Les duels et chroniques étaient déjà
--  réservés aux Mestres ; les scrutins le sont via 0024.)
--
--  Note : l'auto-suppression de COMPTE (RGPD, profiles) reste autorisée — c'est
--  un droit légal, distinct de l'effacement de contenu.
--
--  À exécuter dans le SQL Editor de Supabase (après 0025).
-- ============================================================================

-- posts
drop policy if exists "posts_delete_author_or_admin" on public.posts;
drop policy if exists "posts_delete_admin" on public.posts;
create policy "posts_delete_admin" on public.posts
  for delete to authenticated using (public.is_admin(auth.uid()));

-- commentaires de salon
drop policy if exists "post_comments_delete_author_or_admin" on public.post_comments;
drop policy if exists "post_comments_delete_admin" on public.post_comments;
create policy "post_comments_delete_admin" on public.post_comments
  for delete to authenticated using (public.is_admin(auth.uid()));

-- lettres (corbeaux)
drop policy if exists "ravens_delete_sender_or_admin" on public.ravens;
drop policy if exists "ravens_delete_admin" on public.ravens;
create policy "ravens_delete_admin" on public.ravens
  for delete to authenticated using (public.is_admin(auth.uid()));

-- pactes
drop policy if exists "pacts_delete" on public.pacts;
create policy "pacts_delete" on public.pacts
  for delete to authenticated using (public.is_admin(auth.uid()));

-- requêtes
drop policy if exists "tickets_delete_author_or_admin" on public.tickets;
drop policy if exists "tickets_delete_admin" on public.tickets;
create policy "tickets_delete_admin" on public.tickets
  for delete to authenticated using (public.is_admin(auth.uid()));

-- cimetière (nécrologie du royaume)
drop policy if exists "graveyard_delete_self_or_admin" on public.graveyard;
drop policy if exists "graveyard_delete_admin" on public.graveyard;
create policy "graveyard_delete_admin" on public.graveyard
  for delete to authenticated using (public.is_admin(auth.uid()));

-- ============================================================================
--  Fin de la migration 0026.
-- ============================================================================
