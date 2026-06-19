-- ============================================================================
--  CK3FR RP — Migration 0028 : attribution Pile/Face aléatoire dans les duels
--
--  Avant : le provocateur avait toujours Pile, le défié toujours Face.
--  Maintenant : à l'acceptation, on tire AU HASARD qui prend Pile et qui prend
--  Face, puis on lance la pièce. (Le résultat reste 50/50, mais on ne sait plus
--  à l'avance quel camp a chaque joueur.) On mémorise qui avait Pile.
--
--  À exécuter dans le SQL Editor de Supabase (après 0027).
-- ============================================================================

alter table public.duels
  add column if not exists pile_profile uuid references public.profiles (id) on delete set null;

create or replace function public.resolve_duel(p_duel uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_chal uuid; v_opp uuid; v_status text;
  v_pile uuid; v_face uuid; v_result text; v_winner uuid;
begin
  select challenger, opponent, status into v_chal, v_opp, v_status
    from public.duels where id = p_duel;
  if v_chal is null then raise exception 'Duel introuvable.'; end if;
  if v_uid <> v_opp then raise exception 'Seul l''adversaire défié peut répondre.'; end if;
  if v_status <> 'pending' then raise exception 'Ce duel est déjà tranché.'; end if;

  if not p_accept then
    update public.duels set status = 'declined', resolved_at = now() where id = p_duel;
    return 'declined';
  end if;

  -- Attribution ALÉATOIRE des côtés, puis lancer de la pièce.
  if random() < 0.5 then v_pile := v_chal; v_face := v_opp;
  else                   v_pile := v_opp;  v_face := v_chal;
  end if;
  v_result := case when random() < 0.5 then 'Pile' else 'Face' end;
  v_winner := case when v_result = 'Pile' then v_pile else v_face end;

  update public.duels
     set status = 'done', result = v_result, winner = v_winner,
         pile_profile = v_pile, resolved_at = now()
   where id = p_duel;
  return v_result;
end;
$$;
grant execute on function public.resolve_duel(uuid, boolean) to authenticated;

-- ============================================================================
--  Fin de la migration 0028.
-- ============================================================================
