-- ============================================================================
--  CK3FR RP — Migration 0022 : temps réel des éditions & suppressions
--
--  Les abonnements temps réel des salons ne réagissaient qu'aux INSERT : une
--  édition, un épinglage ou une suppression par un autre joueur (ou un Mestre)
--  ne se propageait pas en direct. On élargit les abonnements côté client aux
--  événements UPDATE/DELETE.
--
--  Problème Postgres : par défaut, un événement DELETE ne transporte que la clé
--  primaire de la ligne effacée. Les filtres temps réel portent sur `channel`
--  (posts) et `post_id` (post_comments), qui ne sont PAS la clé primaire — donc
--  un DELETE filtré ne matcherait jamais. REPLICA IDENTITY FULL fait émettre la
--  ligne complète (anciennes valeurs comprises), ce qui rend ces filtres
--  fiables sur tous les types d'événements.
--
--  (raven_recipients filtre par profile_id, qui fait partie de sa clé primaire
--   composite — pas besoin d'y toucher.)
--
--  À exécuter dans le SQL Editor de Supabase (après 0021).
-- ============================================================================

alter table public.posts         replica identity full;
alter table public.post_comments replica identity full;

-- ============================================================================
--  Fin de la migration 0022.
-- ============================================================================
