-- ============================================================================
--  CK3FR RP — Migration 0043 : Alliances entre joueurs (validées par les Mestres)
--
--  Un joueur PROPOSE une alliance à un autre joueur (depuis la page Alliances ou
--  la fiche du joueur). La proposition est « en attente » : un MESTRE doit la
--  VALIDER (accepter / refuser) avant qu'elle ne devienne active. Un joueur ne
--  crée donc jamais une alliance « comme ça ».
--
--  Les alliances ACTIVES sont publiques (visibles de tous) ; une proposition en
--  attente / refusée n'est visible que des deux parties et des Mestres.
--
--  À exécuter dans le SQL Editor de Supabase (après 0042).
-- ============================================================================

create type public.alliance_status as enum ('pending', 'accepted', 'refused');

create table if not exists public.alliances (
  id               uuid primary key default gen_random_uuid(),
  proposer_profile uuid not null references public.profiles (id) on delete cascade,
  target_profile   uuid not null references public.profiles (id) on delete cascade,
  message          text,
  status           public.alliance_status not null default 'pending',
  resolved_by      uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);
create index if not exists alliances_status_idx on public.alliances (status, created_at desc);
create index if not exists alliances_proposer_idx on public.alliances (proposer_profile);
create index if not exists alliances_target_idx on public.alliances (target_profile);

alter table public.alliances enable row level security;

-- Lecture : alliance active = publique ; sinon réservée aux deux parties + Mestres.
create policy "alliances_select" on public.alliances
  for select to authenticated using (
    status = 'accepted'
    or proposer_profile = auth.uid()
    or target_profile = auth.uid()
    or public.is_admin(auth.uid())
  );

-- Suppression : le proposeur peut retirer SA proposition tant qu'elle est en
-- attente ; un Mestre peut tout retirer.
create policy "alliances_delete" on public.alliances
  for delete to authenticated using (
    (proposer_profile = auth.uid() and status = 'pending')
    or public.is_admin(auth.uid())
  );

-- ── Proposer une alliance (joueur) ──────────────────────────────────────────
create or replace function public.propose_alliance(p_target uuid, p_message text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  if public.is_observer(v_uid) then raise exception 'Un observateur ne peut pas proposer d''alliance.'; end if;
  if p_target is null or p_target = v_uid then raise exception 'Choisis un autre joueur.'; end if;
  if not exists (select 1 from public.profiles where id = p_target and onboarded) then
    raise exception 'Ce joueur est introuvable.';
  end if;
  -- Pas deux fois la même alliance (en attente ou déjà active), dans un sens ou l'autre.
  if exists (
    select 1 from public.alliances
     where status in ('pending', 'accepted')
       and ((proposer_profile = v_uid and target_profile = p_target)
         or (proposer_profile = p_target and target_profile = v_uid))
  ) then
    raise exception 'Une alliance (ou une demande) existe déjà avec ce joueur.';
  end if;

  insert into public.alliances (proposer_profile, target_profile, message)
  values (v_uid, p_target, nullif(trim(coalesce(p_message, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.propose_alliance(uuid, text) to authenticated;

-- ── Valider / refuser (Mestre) ──────────────────────────────────────────────
create or replace function public.decide_alliance(p_id uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Réservé aux Mestres.'; end if;
  update public.alliances
     set status      = case when p_accept then 'accepted'::alliance_status else 'refused'::alliance_status end,
         resolved_by = auth.uid(),
         resolved_at = now()
   where id = p_id and status = 'pending';
  if not found then raise exception 'Demande introuvable ou déjà traitée.'; end if;
end;
$$;
grant execute on function public.decide_alliance(uuid, boolean) to authenticated;

alter table public.alliances replica identity full;
alter publication supabase_realtime add table public.alliances;

-- ============================================================================
--  Fin de la migration 0043.
-- ============================================================================
