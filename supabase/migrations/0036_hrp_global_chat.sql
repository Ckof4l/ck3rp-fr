-- ============================================================================
--  CK3FR RP — Migration 0036 : Salon HRP (chat global temps réel)
--
--  Le HRP devient un vrai chat : une conversation PUBLIQUE permanente, à
--  laquelle tout joueur (non-observateur) écrit. On la marque `is_global` pour
--  la distinguer des conversations créées par les joueurs et la protéger.
--
--  À exécuter dans le SQL Editor de Supabase (après 0035).
-- ============================================================================

alter table public.conversations add column if not exists is_global boolean not null default false;
-- Le salon global n'appartient à personne en particulier.
alter table public.conversations alter column creator drop not null;

-- Crée le Salon HRP s'il n'existe pas encore.
insert into public.conversations (title, creator, is_private, is_global)
select 'Salon HRP', null, false, true
where not exists (select 1 from public.conversations where is_global);

-- On ne peut pas supprimer le salon global.
drop policy if exists "conversations_delete" on public.conversations;
create policy "conversations_delete" on public.conversations
  for delete to authenticated
  using ((creator = auth.uid() or public.is_admin(auth.uid())) and not is_global);

-- ============================================================================
--  Fin de la migration 0036.
-- ============================================================================
