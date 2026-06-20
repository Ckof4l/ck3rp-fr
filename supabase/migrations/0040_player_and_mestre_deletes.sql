-- ============================================================================
--  CK3FR RP — Migration 0040 : qui peut effacer quoi
--
--  Nouvelle règle (remplace l'archive immuable de 0026) :
--   • Un JOUEUR peut retirer SON propre contenu — posts, commentaires, lettres
--     (corbeaux), messages de conversation (y compris le salon HRP) et requêtes.
--   • Un MESTRE peut retirer N'IMPORTE QUEL message, partout (modération totale,
--     y compris HRP et corbeaux privés).
--
--  Restent réservés aux Mestres (intégrité / chronique infalsifiable) :
--     duels (pile ou face), scrutins (votes scellés), cimetière (nécrologie).
--
--  Note : la table `raven_recipients` se purge en cascade quand le corbeau parent
--  est supprimé (FK on delete cascade), donc aucune policy à changer pour elle.
--
--  À exécuter dans le SQL Editor de Supabase (après 0039).
-- ============================================================================

-- posts — auteur ou Mestre
drop policy if exists "posts_delete_admin" on public.posts;
drop policy if exists "posts_delete_author_or_admin" on public.posts;
create policy "posts_delete_author_or_admin" on public.posts
  for delete to authenticated
  using (author_profile = auth.uid() or public.is_admin(auth.uid()));

-- commentaires de salon — auteur ou Mestre
drop policy if exists "post_comments_delete_admin" on public.post_comments;
drop policy if exists "post_comments_delete_author_or_admin" on public.post_comments;
create policy "post_comments_delete_author_or_admin" on public.post_comments
  for delete to authenticated
  using (author_profile = auth.uid() or public.is_admin(auth.uid()));

-- lettres (corbeaux) — expéditeur ou Mestre
drop policy if exists "ravens_delete_admin" on public.ravens;
drop policy if exists "ravens_delete_sender_or_admin" on public.ravens;
create policy "ravens_delete_sender_or_admin" on public.ravens
  for delete to authenticated
  using (from_profile = auth.uid() or public.is_admin(auth.uid()));

-- messages de conversation (inclut le salon HRP global) — auteur ou Mestre
drop policy if exists "conv_messages_delete" on public.conversation_messages;
create policy "conv_messages_delete" on public.conversation_messages
  for delete to authenticated
  using (author_profile = auth.uid() or public.is_admin(auth.uid()));

-- requêtes — auteur ou Mestre
drop policy if exists "tickets_delete_admin" on public.tickets;
drop policy if exists "tickets_delete_author_or_admin" on public.tickets;
create policy "tickets_delete_author_or_admin" on public.tickets
  for delete to authenticated
  using (author_profile = auth.uid() or public.is_admin(auth.uid()));

-- messages d'une requête — auteur ou Mestre (aucune policy DELETE n'existait :
-- même un Mestre ne pouvait pas les retirer).
drop policy if exists "ticket_messages_delete" on public.ticket_messages;
create policy "ticket_messages_delete" on public.ticket_messages
  for delete to authenticated
  using (author_profile = auth.uid() or public.is_admin(auth.uid()));

-- pactes — auteur ou Mestre (restaure l'état d'avant 0026)
drop policy if exists "pacts_delete" on public.pacts;
create policy "pacts_delete" on public.pacts
  for delete to authenticated
  using (author_profile = auth.uid() or public.is_admin(auth.uid()));

-- ── Temps réel des suppressions ─────────────────────────────────────────────
-- Les abonnements realtime filtrent par conversation_id / ticket_id (pas par la
-- clé primaire) ; sans REPLICA IDENTITY FULL, l'événement DELETE ne porte que la
-- PK et le filtre le rejette → la suppression ne s'affiche pas en direct.
alter table public.conversation_messages replica identity full;
alter table public.ticket_messages       replica identity full;

-- ============================================================================
--  Fin de la migration 0040.
--  (duels = 0025, scrutins = 0027, cimetière = 0026 restent Mestre-only.)
-- ============================================================================
