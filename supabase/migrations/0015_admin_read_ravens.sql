-- ============================================================================
--  CK3FR RP — Migration 0015 : les Mestres lisent tous les corbeaux
--
--  Les corbeaux restent privés entre joueurs, MAIS les Mestres (is_admin) ont
--  désormais un droit de lecture sur toutes les lettres (modération / oversight).
--
--  À exécuter dans le SQL Editor de Supabase (après 0014).
-- ============================================================================

drop policy if exists "ravens_select_party" on public.ravens;
create policy "ravens_select_party" on public.ravens
  for select to authenticated using (
    from_profile = auth.uid()
    or public.is_raven_recipient(id, auth.uid())
    or public.is_admin(auth.uid())
  );

drop policy if exists "recipients_select" on public.raven_recipients;
create policy "recipients_select" on public.raven_recipients
  for select to authenticated using (
    profile_id = auth.uid()
    or public.is_raven_sender(raven_id, auth.uid())
    or public.is_admin(auth.uid())
  );

-- ============================================================================
--  Fin de la migration 0015.
-- ============================================================================
