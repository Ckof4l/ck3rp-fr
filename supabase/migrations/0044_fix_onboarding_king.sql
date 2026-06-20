-- ============================================================================
--  CK3FR RP — Migration 0044 : débloque l'inscription des grandes maisons
--
--  BUG : depuis 0039, complete_onboarding met is_king=true quand on choisit une
--  grande maison régnante (Stark, Arryn, Lannister, Durrandon, Jardinier,
--  Martell, Greyjoy, Targaryen). Or le garde-fou guard_profile_privileges
--  interdit TOUT changement de is_king par un non-Mestre → l'inscription échoue
--  avec « Action réservée aux Mestres. » dès qu'on prend une de ces maisons.
--
--  CORRECTIF : complete_onboarding pose un drapeau de transaction
--  (app.onboarding) que le garde-fou reconnaît pour autoriser le passage Roi
--  AUTOMATIQUE, uniquement sur SA PROPRE fiche, pendant l'inscription. Un joueur
--  ne peut donc toujours pas se sacrer Roi « à la main » (un UPDATE direct depuis
--  le client ne pose pas ce drapeau).
--
--  À exécuter dans le SQL Editor de Supabase (après 0043).
-- ============================================================================

create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_onboarding boolean := current_setting('app.onboarding', true) = '1';
begin
  -- Grand Mestre intouchable (0042).
  if old.is_founder
     and auth.uid() is distinct from old.id
     and not public.is_founder(auth.uid()) then
    raise exception 'Le Grand Mestre est intouchable.';
  end if;

  -- Nommer / destituer un Grand Mestre : réservé à un Grand Mestre.
  if (new.is_founder is distinct from old.is_founder) and not public.is_founder(auth.uid()) then
    raise exception 'Seul un Grand Mestre peut nommer un Grand Mestre.';
  end if;

  -- Mestre / observateur / sourdine : réservés aux Mestres.
  if (new.is_admin    is distinct from old.is_admin
      or new.is_observer is distinct from old.is_observer
      or new.muted_until is distinct from old.muted_until)
     and not public.is_admin(auth.uid()) then
    raise exception 'Action réservée aux Mestres.';
  end if;

  -- Roi : réservé aux Mestres, SAUF l'attribution automatique à l'inscription
  -- (complete_onboarding, sur sa propre fiche, drapeau app.onboarding posé).
  if (new.is_king is distinct from old.is_king)
     and not public.is_admin(auth.uid())
     and not (v_onboarding and auth.uid() = new.id) then
    raise exception 'Action réservée aux Mestres.';
  end if;

  return new;
end;
$$;

-- complete_onboarding : pose le drapeau avant de mettre is_king (auto-Roi).
create or replace function public.complete_onboarding(p_character text, p_house text, p_discord text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_king boolean;
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  if coalesce(trim(p_character), '') = '' then raise exception 'Choisis un nom de personnage.'; end if;

  if p_house <> 'autre' and exists (
    select 1 from public.house_claims where house_key = p_house and profile_id <> v_uid
  ) then
    raise exception 'Cette maison est déjà tenue par un autre joueur.';
  end if;

  v_king := p_house = any (array[
    'stark', 'arryn', 'lannister', 'durrandon', 'jardinier', 'martell', 'greyjoy', 'targaryen'
  ]);

  -- Autorise le garde-fou à accepter le passage Roi automatique (transaction-local).
  perform set_config('app.onboarding', '1', true);

  update public.profiles
     set character_name = trim(p_character),
         house          = p_house,
         discord        = nullif(trim(coalesce(p_discord, '')), ''),
         reborn_at      = now(),
         onboarded      = true,
         is_king        = v_king
   where id = v_uid;

  delete from public.house_claims where profile_id = v_uid;
  if p_house <> 'autre' then
    insert into public.house_claims (house_key, profile_id) values (p_house, v_uid);
  end if;
end;
$$;
grant execute on function public.complete_onboarding(text, text, text) to authenticated;

-- ============================================================================
--  Fin de la migration 0044.
-- ============================================================================
