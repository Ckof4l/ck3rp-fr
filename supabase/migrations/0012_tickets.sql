-- ============================================================================
--  CK3FR RP — Migration 0012 : Requêtes (tickets de validation)
--
--  Un joueur soumet une requête d'action RP (ex. « Alliance Stark-Lannister »).
--  Les Mestres la valident ou la refusent (avec un motif). Le joueur suit le
--  statut en direct. Un fil de discussion permet de clarifier avant de trancher.
--
--  À exécuter dans le SQL Editor de Supabase (après 0011).
-- ============================================================================

create type public.ticket_status as enum ('pending', 'accepted', 'refused');

create table if not exists public.tickets (
  id             uuid primary key default gen_random_uuid(),
  author_profile uuid not null references public.profiles (id) on delete cascade,
  category       text,
  subject        text not null,
  body           text not null default '',
  status         public.ticket_status not null default 'pending',
  resolution     text,
  resolved_by    uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz
);
create index if not exists tickets_status_idx on public.tickets (status, created_at desc);

create table if not exists public.ticket_messages (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      uuid not null references public.tickets (id) on delete cascade,
  author_profile uuid not null references public.profiles (id) on delete cascade,
  body           text not null,
  created_at     timestamptz not null default now()
);
create index if not exists ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);

-- Auteur d'une requête (SECURITY DEFINER → pas de récursion RLS).
create or replace function public.ticket_author(p_ticket uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select author_profile from public.tickets where id = p_ticket;
$$;

alter table public.tickets         enable row level security;
alter table public.ticket_messages enable row level security;

-- tickets : le joueur voit/crée les siens ; les Mestres voient tout et décident.
create policy "tickets_select" on public.tickets
  for select to authenticated
  using (author_profile = auth.uid() or public.is_admin(auth.uid()));
create policy "tickets_insert" on public.tickets
  for insert to authenticated
  with check (author_profile = auth.uid() and not public.is_observer(auth.uid()));
create policy "tickets_update_admin" on public.tickets
  for update to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "tickets_delete_author_or_admin" on public.tickets
  for delete to authenticated
  using (author_profile = auth.uid() or public.is_admin(auth.uid()));

-- ticket_messages : visibles/écrits par l'auteur de la requête ou un Mestre.
create policy "ticket_messages_select" on public.ticket_messages
  for select to authenticated
  using (public.ticket_author(ticket_id) = auth.uid() or public.is_admin(auth.uid()));
create policy "ticket_messages_insert" on public.ticket_messages
  for insert to authenticated
  with check (
    author_profile = auth.uid()
    and not public.is_observer(auth.uid())
    and (public.ticket_author(ticket_id) = auth.uid() or public.is_admin(auth.uid()))
  );

alter publication supabase_realtime add table public.tickets;
alter publication supabase_realtime add table public.ticket_messages;

-- ============================================================================
--  Fin de la migration 0012.
-- ============================================================================
