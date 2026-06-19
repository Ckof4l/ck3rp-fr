-- ============================================================================
--  CK3FR RP — Migration 0021 : écritures atomiques (RPC SECURITY DEFINER)
--
--  Quatre opérations faisaient plusieurs écritures côté client, sans
--  transaction : une panne entre deux appels laissait des états bâtards
--  (lettre sans destinataires, pacte sans maisons, cimetière incohérent,
--  bannière dédoublée/absente). On les regroupe chacune dans une fonction
--  serveur transactionnelle. Chaque fonction réapplique elle-même les
--  contrôles d'accès que la RLS garantissait (sourdine, observateur, Mestre),
--  puisque SECURITY DEFINER court-circuite la RLS.
--
--  À exécuter dans le SQL Editor de Supabase (après 0020).
-- ============================================================================

-- ── 1. Envoi d'une lettre : corbeau + destinataires en une transaction ──────
--  Le téléversement de l'image reste côté client (Storage) ; on ne passe ici
--  que le chemin déjà obtenu. Retourne { id, recipient_count }.
create or replace function public.send_letter(
  p_scope       text,
  p_subject     text,
  p_body        text,
  p_to_profile  uuid    default null,
  p_to_house    text    default null,
  p_image_path  text    default null,
  p_thread_id   uuid    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_raven uuid;
  v_count int  := 0;
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  if public.is_muted(v_uid) then raise exception 'Tu es réduit au silence.'; end if;
  if p_scope not in ('user', 'house', 'realm') then raise exception 'Portée inconnue.'; end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'Le message est vide.'; end if;

  insert into public.ravens (thread_id, from_profile, scope, to_scope, subject, body, image_path)
  values (
    coalesce(p_thread_id, gen_random_uuid()),
    v_uid,
    p_scope::public.raven_scope,
    case when p_scope = 'house' then p_to_house else null end,
    nullif(trim(coalesce(p_subject, '')), ''),
    p_body,
    p_image_path
  )
  returning id into v_raven;

  if p_scope = 'user' then
    if p_to_profile is not null then
      insert into public.raven_recipients (raven_id, profile_id) values (v_raven, p_to_profile);
      v_count := 1;
    end if;
  elsif p_scope = 'house' then
    insert into public.raven_recipients (raven_id, profile_id)
      select v_raven, id from public.profiles
       where house = p_to_house and onboarded and id <> v_uid;
    get diagnostics v_count = row_count;
  else -- 'realm'
    insert into public.raven_recipients (raven_id, profile_id)
      select v_raven, id from public.profiles
       where onboarded and id <> v_uid;
    get diagnostics v_count = row_count;
  end if;

  return jsonb_build_object('id', v_raven, 'recipient_count', v_count);
end;
$$;
grant execute on function public.send_letter(text, text, text, uuid, text, text, uuid) to authenticated;

-- ── 2. Création d'un pacte : traité + maisons signataires en une transaction ─
create or replace function public.create_pact(
  p_title    text,
  p_body     text,
  p_my_house text,
  p_houses   text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_pact uuid;
  v_now  timestamptz := now();
  v_set  text[];
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  if public.is_observer(v_uid) then raise exception 'Un observateur ne peut pas proposer de pacte.'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Le pacte doit avoir un titre.'; end if;

  insert into public.pacts (author_profile, title, body)
  values (v_uid, trim(p_title), trim(coalesce(p_body, '')))
  returning id into v_pact;

  -- Maisons : celles proposées + celle de l'auteur (sauf « autre »), dédoublonnées.
  select array(
    select distinct hk from (
      select unnest(coalesce(p_houses, '{}')) as hk
      union
      select p_my_house where p_my_house is not null and p_my_house <> 'autre'
    ) s where hk is not null and hk <> ''
  ) into v_set;

  insert into public.pact_houses (pact_id, house_key, signed_by, signed_at)
    select v_pact, hk,
           case when hk = p_my_house then v_uid else null end,
           case when hk = p_my_house then v_now else null end
      from unnest(v_set) as hk;

  return v_pact;
end;
$$;
grant execute on function public.create_pact(text, text, text, text[]) to authenticated;

-- ── 3. Renaissance : inhumation + nouveau prénom en une transaction ─────────
--  La maison ne change pas ; on la lit sur le profil pour éviter toute dérive.
create or replace function public.rebirth(
  p_old_character text,
  p_cause         text,
  p_new_name      text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_house text;
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  if coalesce(trim(p_new_name), '') = '' then raise exception 'Choisis un nouveau prénom.'; end if;

  select house into v_house from public.profiles where id = v_uid;

  insert into public.graveyard (profile_id, character_name, house, cause)
  values (v_uid, p_old_character, v_house, nullif(trim(coalesce(p_cause, '')), ''));

  update public.profiles
     set character_name = trim(p_new_name),
         reborn_at      = now()
   where id = v_uid;
end;
$$;
grant execute on function public.rebirth(text, text, text) to authenticated;

-- ── 4. Bannière d'annonce : remplacement atomique (au plus une à la fois) ───
create or replace function public.set_announcement(p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if not public.is_admin(v_uid) then raise exception 'Réservé aux Mestres.'; end if;
  if coalesce(trim(p_message), '') = '' then raise exception 'Le message est vide.'; end if;

  delete from public.announcements;
  insert into public.announcements (message, author_profile)
  values (trim(p_message), v_uid);
end;
$$;
grant execute on function public.set_announcement(text) to authenticated;

-- ============================================================================
--  Fin de la migration 0021.
-- ============================================================================
