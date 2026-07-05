-- ============================================================================
--  CK3FR RP — Migration 0050 : notifications (mentions @joueur)
--
--  Quand un joueur écrit « @Nom De Personnage » dans une lettre ou un
--  commentaire de salon, le joueur visé reçoit une notification (cloche dans
--  la barre du haut, temps réel). Le client détecte les mentions à l'envoi et
--  insère les lignes ; la RLS garantit qu'on ne peut créer une notification
--  qu'en son propre nom (actor) et qu'on ne lit/marque lu que les siennes.
--
--  À exécuter dans le SQL Editor de Supabase (après 0049).
-- ============================================================================

create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles (id) on delete cascade, -- destinataire
  actor_profile uuid references public.profiles (id) on delete cascade,          -- qui mentionne
  kind          text not null default 'mention',
  channel       text,                                                            -- clé de salon (lien)
  post_id       uuid references public.posts (id) on delete cascade,             -- lettre visée
  excerpt       text,                                                            -- aperçu du texte
  created_at    timestamptz not null default now(),
  read_at       timestamptz
);

create index if not exists notifications_profile_recent
  on public.notifications (profile_id, created_at desc);

alter table public.notifications enable row level security;

-- Chacun ne lit que ses notifications.
create policy "notifications_select_own" on public.notifications
  for select to authenticated using (profile_id = auth.uid());

-- On ne notifie qu'en son propre nom, et jamais soi-même.
create policy "notifications_insert_actor" on public.notifications
  for insert to authenticated
  with check (actor_profile = auth.uid() and profile_id <> auth.uid());

-- Marquer lu : seulement les siennes.
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "notifications_delete_own" on public.notifications
  for delete to authenticated using (profile_id = auth.uid());

-- Temps réel : la cloche s'allume sans recharger la page.
-- (Si la table est déjà dans la publication, cette ligne renvoie une erreur
--  « already member » sans gravité — l'ignorer.)
alter publication supabase_realtime add table public.notifications;

-- ============================================================================
--  Fin de la migration 0050.
-- ============================================================================
