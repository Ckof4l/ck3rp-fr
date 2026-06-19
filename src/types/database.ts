/* ============================================================================
   Types des tables Supabase (miroir des migrations SQL).
   À régénérer plus tard avec `supabase gen types typescript` une fois le
   projet créé ; pour l'instant, maintenus à la main.
   ========================================================================== */

export type RavenScope = 'user' | 'house' | 'realm'
export type ReportTargetType = 'raven' | 'post' | 'comment' | 'profile' | 'proclamation'

export interface Profile {
  id: string // = auth.users.id
  username: string
  character_name: string
  house: string
  discord: string | null
  is_admin: boolean
  is_observer: boolean
  is_king: boolean
  is_founder: boolean
  onboarded: boolean
  muted_until: string | null
  reborn_at: string
  created_at: string
}

export interface Post {
  id: string
  channel: string
  author_profile: string
  title: string | null
  body: string
  image_path: string | null
  pinned: boolean
  created_at: string
  updated_at: string | null
}

export interface PostComment {
  id: string
  post_id: string
  author_profile: string
  body: string
  created_at: string
  updated_at: string | null
}

export interface HouseClaim {
  house_key: string
  profile_id: string
  claimed_at: string
}

export interface Raven {
  id: string
  thread_id: string
  from_profile: string
  scope: RavenScope
  to_scope: string | null // clé de maison si scope='house', sinon null
  subject: string | null
  body: string
  image_path: string | null
  sent_at: string
}

export interface RavenRecipient {
  raven_id: string
  profile_id: string
  read_at: string | null
}

export interface Proclamation {
  id: string
  author_profile: string
  title: string
  body: string
  image_path: string | null
  created_at: string
}

export interface Comment {
  id: string
  proclamation_id: string
  author_profile: string
  text: string
  created_at: string
}

export interface GraveEntry {
  id: string
  profile_id: string
  character_name: string
  house: string
  cause: string | null
  died_at: string
}

export interface Archive {
  profile_id: string
  thread_id: string
  archived_at: string
}

export interface Report {
  id: string
  reporter_profile: string
  target_type: ReportTargetType
  target_id: string
  reason: string
  created_at: string
  resolved: boolean
}
