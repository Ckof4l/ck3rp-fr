-- ============================================================================
--  CK3FR RP — Correctif 0002 : récursion infinie entre les politiques RLS
--  de `ravens` et `raven_recipients`.
--
--  Cause : la politique SELECT de `ravens` interrogeait `raven_recipients`,
--  dont la politique SELECT interrogeait `ravens` → boucle (erreur 42P17).
--  Remède : déléguer ces vérifications à des fonctions SECURITY DEFINER, qui
--  contournent la RLS (comme `is_admin`) et brisent la récursion.
--
--  À exécuter dans le SQL Editor de Supabase (après 0001).
-- ============================================================================

-- L'utilisateur est-il destinataire de cette lettre ?
create or replace function public.is_raven_recipient(p_raven uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.raven_recipients rr
    where rr.raven_id = p_raven and rr.profile_id = p_uid
  );
$$;

-- L'utilisateur est-il l'expéditeur de cette lettre ?
create or replace function public.is_raven_sender(p_raven uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ravens r
    where r.id = p_raven and r.from_profile = p_uid
  );
$$;

-- ── ravens : lecture par l'expéditeur ou un destinataire ────────────────────
drop policy if exists "ravens_select_party" on public.ravens;
create policy "ravens_select_party" on public.ravens
  for select to authenticated using (
    from_profile = auth.uid()
    or public.is_raven_recipient(id, auth.uid())
  );

-- ── raven_recipients : lecture par le destinataire ou l'expéditeur ──────────
drop policy if exists "recipients_select" on public.raven_recipients;
create policy "recipients_select" on public.raven_recipients
  for select to authenticated using (
    profile_id = auth.uid()
    or public.is_raven_sender(raven_id, auth.uid())
  );

-- ── raven_recipients : l'expéditeur ajoute les destinataires ────────────────
drop policy if exists "recipients_insert_by_sender" on public.raven_recipients;
create policy "recipients_insert_by_sender" on public.raven_recipients
  for insert to authenticated with check (
    public.is_raven_sender(raven_id, auth.uid())
  );

-- ============================================================================
--  Fin du correctif 0002.
-- ============================================================================
