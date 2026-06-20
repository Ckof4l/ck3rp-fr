-- ============================================================================
--  CK3FR RP — RESET COMPLET DES JOUEURS  ⚠️  IRRÉVERSIBLE
--
--  Supprime TOUS les profils et leurs données liées (posts, commentaires,
--  corbeaux, pactes, requêtes, scrutins, duels, cimetière, conversations
--  privées…) pour repartir de zéro : chacun pourra se réinscrire.
--
--  Ce qui SURVIT :
--    • Le Salon HRP global (creator = null, donc pas supprimé en cascade).
--    • Les comptes Discord eux-mêmes (auth.users) — les gens se reconnectent
--      et repassent l'inscription. Le 1er à se réinscrire redevient Grand Mestre.
--
--  On vide aussi la liste des bannis pour que personne ne reste bloqué.
--
--  À COLLER DANS Supabase → SQL Editor, une seule fois, en pleine conscience.
--  AUCUNE ANNULATION POSSIBLE. Fais-le quand tu es prêt à tout remettre à zéro.
-- ============================================================================

-- Remet à zéro l'inscription : la suppression des profils cascade sur tout le
-- contenu joueur via les clés étrangères ON DELETE CASCADE.
delete from public.banned_users;
delete from public.profiles;

-- ============================================================================
--  Fin du reset.  Reconnecte-toi en premier pour récupérer le rôle Grand Mestre.
-- ============================================================================
