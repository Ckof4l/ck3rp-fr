-- ============================================================================
--  CK3FR RP — Migration 0025 : Le Sort (dés & pile ou face)
--
--  Pour trancher une décision au hasard de façon INCONTESTABLE : le tirage est
--  fait côté serveur (random() de Postgres) et inscrit dans un registre public.
--  Personne ne peut écrire directement dans `rolls` (aucune policy d'insertion)
--  — seule la fonction roll_dice() le fait → résultat infalsifiable.
--
--  À exécuter dans le SQL Editor de Supabase (après 0024).
-- ============================================================================

create table if not exists public.rolls (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind       text not null,            -- 'coin' | 'd6' | 'd20' | 'd100'
  label      text,                     -- raison du tirage (facultatif)
  result     text not null,
  created_at timestamptz not null default now()
);
create index if not exists rolls_created_idx on public.rolls (created_at desc);

-- Tirage côté serveur (SECURITY DEFINER) : seul point d'écriture de `rolls`.
create or replace function public.roll_dice(p_kind text, p_label text)
returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_result text;
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  if public.is_observer(v_uid) then raise exception 'Un observateur ne peut pas tirer le sort.'; end if;

  if    p_kind = 'coin' then v_result := case when random() < 0.5 then 'Pile' else 'Face' end;
  elsif p_kind = 'd6'   then v_result := (floor(random() * 6) + 1)::text;
  elsif p_kind = 'd20'  then v_result := (floor(random() * 20) + 1)::text;
  elsif p_kind = 'd100' then v_result := (floor(random() * 100) + 1)::text;
  else raise exception 'Type de tirage inconnu.';
  end if;

  insert into public.rolls (profile_id, kind, label, result)
  values (v_uid, p_kind, nullif(trim(coalesce(p_label, '')), ''), v_result);

  return v_result;
end;
$$;
grant execute on function public.roll_dice(text, text) to authenticated;

alter table public.rolls enable row level security;

-- Registre public ; aucune écriture directe (le RPC seul écrit) ; purge admin.
create policy "rolls_select" on public.rolls for select to authenticated using (true);
create policy "rolls_admin_delete" on public.rolls
  for delete to authenticated using (public.is_admin(auth.uid()));

alter publication supabase_realtime add table public.rolls;

-- ============================================================================
--  Fin de la migration 0025.
-- ============================================================================
