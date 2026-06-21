-- ============================================================================
--  CK3FR RP — Migration 0046 : épingler un post = réservé aux Mestres
--
--  Un joueur peut toujours éditer SON post, mais ne peut plus l'ÉPINGLER. Seul
--  un Mestre (is_admin) change la colonne `pinned`. Garde-fou côté serveur (un
--  UPDATE direct depuis le client est aussi bloqué), en plus du bouton masqué
--  dans l'UI.
--
--  À exécuter dans le SQL Editor de Supabase (après 0045).
-- ============================================================================

create or replace function public.guard_post_pin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.pinned is distinct from old.pinned) and not public.is_admin(auth.uid()) then
    raise exception 'Seul un Mestre peut épingler un message.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_post_pin_trg on public.posts;
create trigger guard_post_pin_trg
  before update on public.posts
  for each row execute function public.guard_post_pin();

-- ============================================================================
--  Fin de la migration 0046.
-- ============================================================================
