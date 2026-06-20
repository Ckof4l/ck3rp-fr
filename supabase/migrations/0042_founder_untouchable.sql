-- ============================================================================
--  CK3FR RP — Migration 0042 : le Grand Mestre est intouchable
--
--  Le fondateur (is_founder, = le tout premier inscrit) est l'autorité suprême.
--  Jusqu'ici un simple Mestre pouvait encore modifier SON profil : le
--  rétrograder (is_admin/is_king), le rendre muet, le renommer ou le déplacer
--  de maison. Il ne pouvait pas lui retirer is_founder, mais le reste passait.
--
--  Désormais : NUL ne peut modifier le profil d'un Grand Mestre, sauf lui-même
--  ou un autre Grand Mestre. Le bannissement/exclusion le protégeait déjà
--  (0038 + 0041). Couvre aussi admin_mute / admin_set_player, qui passent par
--  une UPDATE sur profiles et déclenchent donc ce garde-fou.
--
--  À exécuter dans le SQL Editor de Supabase (après 0041).
-- ============================================================================

create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Protection absolue du Grand Mestre : seul lui-même (ou un autre Grand
  -- Mestre) peut toucher à son profil. Bloque rétrogradation, sourdine, renommage…
  if old.is_founder
     and auth.uid() is distinct from old.id
     and not public.is_founder(auth.uid()) then
    raise exception 'Le Grand Mestre est intouchable.';
  end if;

  -- Nommer / destituer un Grand Mestre : réservé à un Grand Mestre.
  if (new.is_founder is distinct from old.is_founder) and not public.is_founder(auth.uid()) then
    raise exception 'Seul un Grand Mestre peut nommer un Grand Mestre.';
  end if;

  -- Rôles & sourdine : réservés aux Mestres.
  if (new.is_admin    is distinct from old.is_admin
      or new.is_observer is distinct from old.is_observer
      or new.is_king     is distinct from old.is_king
      or new.muted_until is distinct from old.muted_until)
     and not public.is_admin(auth.uid()) then
    raise exception 'Action réservée aux Mestres.';
  end if;

  return new;
end;
$$;

-- ============================================================================
--  Fin de la migration 0042.
-- ============================================================================
