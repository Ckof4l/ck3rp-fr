-- ============================================================================
--  CK3FR RP — Migration 0010 : pastilles de non-lus par salon
--
--  channel_reads : pour chaque joueur, la dernière fois qu'il a ouvert un
--  salon. unread_counts() compte les posts plus récents (écrits par d'autres).
--
--  À exécuter dans le SQL Editor de Supabase (après 0009).
-- ============================================================================

create table if not exists public.channel_reads (
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  channel      text not null,
  last_seen_at timestamptz not null default now(),
  primary key (profile_id, channel)
);

alter table public.channel_reads enable row level security;

create policy "channel_reads_select_own" on public.channel_reads
  for select to authenticated using (profile_id = auth.uid());
create policy "channel_reads_insert_own" on public.channel_reads
  for insert to authenticated with check (profile_id = auth.uid());
create policy "channel_reads_update_own" on public.channel_reads
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Nombre de posts non lus par salon, pour l'utilisateur courant.
create or replace function public.unread_counts()
returns table (channel text, n bigint)
language sql
stable
security definer
set search_path = public
as $$
  select p.channel, count(*)::bigint
  from public.posts p
  left join public.channel_reads r
    on r.profile_id = auth.uid() and r.channel = p.channel
  where p.created_at > coalesce(r.last_seen_at, '-infinity'::timestamptz)
    and p.author_profile <> auth.uid()
  group by p.channel;
$$;
grant execute on function public.unread_counts() to authenticated;

-- ============================================================================
--  Fin de la migration 0010.
-- ============================================================================
