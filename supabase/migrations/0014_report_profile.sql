-- ============================================================================
--  CK3FR RP — Migration 0014 : signaler un joueur
--
--  Ajoute la cible 'profile' aux signalements (pour signaler un joueur depuis
--  sa fiche). La table reports et ses politiques existent déjà (0001).
--
--  À exécuter dans le SQL Editor de Supabase (après 0013).
-- ============================================================================

alter type public.report_target add value if not exists 'profile';

-- ============================================================================
--  Fin de la migration 0014.
-- ============================================================================
