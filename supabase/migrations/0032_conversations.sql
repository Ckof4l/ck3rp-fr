-- ============================================================================
--  CK3FR RP — Migration 0032 : Conversations (salons de discussion libres)
--
--  Un joueur ouvre une conversation, PUBLIQUE (visible & ouverte à tous) ou
--  PRIVÉE (réservée aux membres qu'il invite). Messages en temps réel.
--
--  À exécuter dans le SQL Editor de Supabase (après 0031).
-- ============================================================================

create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  creator    uuid not null references public.profiles (id) on delete cascade,
  is_private boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists conversations_created_idx on public.conversations (created_at desc);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);
create index if not exists conversation_members_profile_idx on public.conversation_members (profile_id);

create table if not exists public.conversation_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  author_profile  uuid not null references public.profiles (id) on delete cascade,
  body            text not null,
  created_at      timestamptz not null default now()
);
create index if not exists conversation_messages_conv_idx on public.conversation_messages (conversation_id, created_at);

-- ── Helpers (SECURITY DEFINER → pas de récursion RLS) ───────────────────────
create or replace function public.conv_is_member(p_conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members
                  where conversation_id = p_conv and profile_id = auth.uid());
$$;

create or replace function public.conv_visible(p_conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select c.is_private = false or public.conv_is_member(c.id) or public.is_admin(auth.uid())
  from public.conversations c where c.id = p_conv;
$$;

create or replace function public.can_post_conv(p_conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not public.is_observer(auth.uid()) and not public.is_muted(auth.uid())
     and (c.is_private = false or public.conv_is_member(c.id))
  from public.conversations c where c.id = p_conv;
$$;

-- ── Création atomique (conversation + créateur + membres si privée) ─────────
create or replace function public.create_conversation(p_title text, p_private boolean, p_members uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_conv uuid; v_m uuid;
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  if public.is_observer(v_uid) then raise exception 'Un observateur ne peut pas créer de conversation.'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Donne un titre à la conversation.'; end if;

  insert into public.conversations (title, creator, is_private)
  values (trim(p_title), v_uid, coalesce(p_private, false))
  returning id into v_conv;

  insert into public.conversation_members (conversation_id, profile_id) values (v_conv, v_uid);

  if coalesce(p_private, false) then
    foreach v_m in array coalesce(p_members, '{}'::uuid[]) loop
      if v_m <> v_uid and exists (select 1 from public.profiles where id = v_m) then
        insert into public.conversation_members (conversation_id, profile_id)
        values (v_conv, v_m) on conflict do nothing;
      end if;
    end loop;
  end if;
  return v_conv;
end;
$$;
grant execute on function public.create_conversation(text, boolean, uuid[]) to authenticated;

alter table public.conversations         enable row level security;
alter table public.conversation_members  enable row level security;
alter table public.conversation_messages enable row level security;

-- conversations : visibles si publiques ou si l'on est membre. Création via RPC.
create policy "conversations_select" on public.conversations
  for select to authenticated using (public.conv_visible(id));
create policy "conversations_update" on public.conversations
  for update to authenticated
  using (creator = auth.uid() or public.is_admin(auth.uid()))
  with check (creator = auth.uid() or public.is_admin(auth.uid()));
create policy "conversations_delete" on public.conversations
  for delete to authenticated using (creator = auth.uid() or public.is_admin(auth.uid()));

-- membres : visibles si la conversation l'est ; le créateur (ou un Mestre) ajoute ;
--           on peut se retirer soi-même.
create policy "conv_members_select" on public.conversation_members
  for select to authenticated using (public.conv_visible(conversation_id));
create policy "conv_members_insert" on public.conversation_members
  for insert to authenticated with check (
    exists (select 1 from public.conversations c where c.id = conversation_id
            and (c.creator = auth.uid() or public.is_admin(auth.uid())))
  );
create policy "conv_members_delete" on public.conversation_members
  for delete to authenticated using (
    profile_id = auth.uid()
    or exists (select 1 from public.conversations c where c.id = conversation_id
               and (c.creator = auth.uid() or public.is_admin(auth.uid())))
  );

-- messages : visibles si la conversation l'est ; postés selon can_post_conv ;
--            suppression réservée aux Mestres (archive immuable).
create policy "conv_messages_select" on public.conversation_messages
  for select to authenticated using (public.conv_visible(conversation_id));
create policy "conv_messages_insert" on public.conversation_messages
  for insert to authenticated with check (
    author_profile = auth.uid() and public.can_post_conv(conversation_id)
  );
create policy "conv_messages_delete" on public.conversation_messages
  for delete to authenticated using (public.is_admin(auth.uid()));

alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.conversation_members;
alter publication supabase_realtime add table public.conversation_messages;

-- ============================================================================
--  Fin de la migration 0032.
-- ============================================================================
