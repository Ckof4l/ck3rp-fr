-- ============================================================================
--  CK3FR RP — Migration 0005 : modération & sécurité de la Citadelle
--
--  1. Ferme une faille : un joueur pouvait se sacrer Roi lui-même (is_king
--     n'était pas protégé par le garde-fou des rôles).
--  2. Ajoute le type de cible 'post' aux signalements.
--  3. RPC de réinitialisation du contenu RP (réservée aux Grands Mestres).
--
--  À exécuter dans le SQL Editor de Supabase (après 0004).
-- ============================================================================

-- ── 2. Type de cible des signalements : ajouter 'post' (salons) ─────────────
alter type public.report_target add value if not exists 'post';

-- ── 1. Garde-fou des rôles : protéger aussi is_king ─────────────────────────
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.is_admin    is distinct from old.is_admin
      or new.is_observer is distinct from old.is_observer
      or new.is_king     is distinct from old.is_king)
     and not public.is_admin(auth.uid()) then
    raise exception 'Modification des rôles réservée aux Grands Mestres.';
  end if;
  return new;
end;
$$;

-- ── 3. Réinitialisation du contenu RP (posts, lettres, commentaires…) ───────
--      Ne touche PAS aux comptes : seuls les contenus sont effacés.
create or replace function public.admin_purge_content()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Réservé aux Grands Mestres.';
  end if;
  delete from public.post_comments;
  delete from public.posts;
  delete from public.raven_recipients;
  delete from public.ravens;
  delete from public.archives;
  delete from public.reports;
end;
$$;
grant execute on function public.admin_purge_content() to authenticated;

-- ============================================================================
--  Fin de la migration 0005.
-- ============================================================================
