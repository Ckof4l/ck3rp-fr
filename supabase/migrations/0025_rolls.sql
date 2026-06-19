-- ============================================================================
--  CK3FR RP — Migration 0025 : Le Sort — duel à pile ou face entre deux joueurs
--
--  Un joueur DÉFIE un adversaire précis. L'adversaire accepte (la pièce est
--  alors lancée côté serveur, infalsifiable) ou refuse. Convention : le
--  challenger prend PILE, l'adversaire prend FACE. Le résultat désigne le
--  vainqueur. Registre public.
--
--  À exécuter dans le SQL Editor de Supabase (après 0024).
-- ============================================================================

create table if not exists public.duels (
  id          uuid primary key default gen_random_uuid(),
  challenger  uuid not null references public.profiles (id) on delete cascade,
  opponent    uuid not null references public.profiles (id) on delete cascade,
  reason      text,
  status      text not null default 'pending',   -- 'pending' | 'done' | 'declined'
  result      text,                              -- 'Pile' (challenger) | 'Face' (adversaire)
  winner      uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  check (challenger <> opponent)
);
create index if not exists duels_created_idx  on public.duels (created_at desc);
create index if not exists duels_opponent_idx on public.duels (opponent, status);

-- Lancer un défi à un adversaire précis (non-observateur).
create or replace function public.create_duel(p_opponent uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_duel uuid;
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  if public.is_observer(v_uid) then raise exception 'Un observateur ne peut pas défier.'; end if;
  if p_opponent = v_uid then raise exception 'On ne se défie pas soi-même.'; end if;
  if not exists (select 1 from public.profiles where id = p_opponent) then
    raise exception 'Adversaire introuvable.';
  end if;

  insert into public.duels (challenger, opponent, reason)
  values (v_uid, p_opponent, nullif(trim(coalesce(p_reason, '')), ''))
  returning id into v_duel;
  return v_duel;
end;
$$;
grant execute on function public.create_duel(uuid, text) to authenticated;

-- Réponse de l'adversaire : accepte (→ pièce lancée) ou refuse. Lui seul peut.
create or replace function public.resolve_duel(p_duel uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_chal uuid; v_opp uuid; v_status text; v_result text; v_winner uuid;
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

  -- Pièce serveur : PILE = challenger, FACE = adversaire.
  v_result := case when random() < 0.5 then 'Pile' else 'Face' end;
  v_winner := case when v_result = 'Pile' then v_chal else v_opp end;
  update public.duels
     set status = 'done', result = v_result, winner = v_winner, resolved_at = now()
   where id = p_duel;
  return v_result;
end;
$$;
grant execute on function public.resolve_duel(uuid, boolean) to authenticated;

alter table public.duels enable row level security;

-- Registre public ; écriture via RPC seulement ; purge réservée aux Mestres.
create policy "duels_select" on public.duels for select to authenticated using (true);
create policy "duels_admin_delete" on public.duels
  for delete to authenticated using (public.is_admin(auth.uid()));

alter publication supabase_realtime add table public.duels;

-- ============================================================================
--  Fin de la migration 0025.
-- ============================================================================
