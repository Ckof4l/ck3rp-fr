-- ============================================================================
--  CK3FR RP — Migration 0033 : les Mestres voient toutes les conversations
--
--  Oversight / modération : un Mestre (is_admin) voit toutes les conversations
--  (même privées), leurs membres et leurs messages. (Les corbeaux le sont déjà
--  via 0015 ; pactes/posts/chroniques sont publics.)
--
--  À exécuter dans le SQL Editor de Supabase (après 0032).
-- ============================================================================

create or replace function public.conv_visible(p_conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select c.is_private = false
      or public.conv_is_member(c.id)
      or public.is_admin(auth.uid())
  from public.conversations c where c.id = p_conv;
$$;

-- conv_members_select et conv_messages_select utilisent déjà conv_visible →
-- ils incluent désormais les Mestres. On aligne aussi la visibilité des
-- conversations elles-mêmes.
drop policy if exists "conversations_select" on public.conversations;
create policy "conversations_select" on public.conversations
  for select to authenticated using (public.conv_visible(id));

-- ============================================================================
--  Fin de la migration 0033.
-- ============================================================================
