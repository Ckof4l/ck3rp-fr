-- ============================================================================
-- 0038 — Hiérarchie de bannissement
-- Seuls les Grands Mestres (is_founder) peuvent bannir un Mestre (is_admin).
-- Un Mestre ne peut bannir ni un Mestre ni un Grand Mestre. Personne ne bannit
-- un Grand Mestre via l'app (protection des pairs).
-- ============================================================================

-- ── RLS : on durcit la suppression de profils selon la hiérarchie ──
drop policy if exists "profiles_delete_self_or_admin" on public.profiles;
create policy "profiles_delete_hierarchy" on public.profiles
  for delete to authenticated
  using (
    id = auth.uid()                                                   -- soi-même
    or (public.is_founder(auth.uid()) and not is_founder)             -- Grand Mestre : tout sauf un Grand Mestre
    or (public.is_admin(auth.uid()) and not is_admin and not is_founder) -- Mestre : ni Mestre ni Grand Mestre
  );

-- ── RPC : bannissement (= reset) avec messages d'erreur clairs ──
create or replace function public.ban_profile(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_admin   boolean;
  v_caller_founder boolean;
  v_target_admin   boolean;
  v_target_founder boolean;
begin
  select is_admin, is_founder into v_caller_admin, v_caller_founder
    from public.profiles where id = auth.uid();
  if not coalesce(v_caller_admin, false) then
    raise exception 'Réservé aux Mestres.';
  end if;

  select is_admin, is_founder into v_target_admin, v_target_founder
    from public.profiles where id = p_id;
  if v_target_founder is null and v_target_admin is null then
    raise exception 'Profil introuvable.';
  end if;
  if coalesce(v_target_founder, false) then
    raise exception 'Un Grand Mestre ne peut pas être banni.';
  end if;
  if coalesce(v_target_admin, false) and not coalesce(v_caller_founder, false) then
    raise exception 'Seul un Grand Mestre peut bannir un Mestre.';
  end if;

  delete from public.profiles where id = p_id;
end;
$$;

grant execute on function public.ban_profile(uuid) to authenticated;
