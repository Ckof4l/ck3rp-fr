import { supabase } from './supabase'
import { listPlayers } from './directory'
import type { Profile } from '../types/database'

/* ============================================================================
   Mentions @joueur — détection des « @Nom De Personnage » dans un texte,
   découpage pour le rendu (surlignage) et création des notifications.
   Le référentiel des joueurs est mis en cache pour la session.
   ========================================================================== */

let cache: Profile[] | null = null
let inflight: Promise<Profile[]> | null = null

/** Joueurs connus (cache de session) — sert au parsing et au rendu. */
export function mentionPlayers(): Promise<Profile[]> {
  if (cache) return Promise.resolve(cache)
  inflight ??= listPlayers().then((ps) => {
    cache = ps
    return ps
  })
  return inflight
}

export type MentionPart = string | { player: Profile }

/** Découpe un texte en segments : les « @Nom » reconnus deviennent { player }.
   Les noms comportent des espaces : on matche les plus longs d'abord. */
export function splitMentions(text: string, players: Profile[]): MentionPart[] {
  if (!text.includes('@') || !players.length) return [text]
  const sorted = players
    .filter((p) => (p.character_name ?? '').trim().length >= 2)
    .sort((a, b) => b.character_name.length - a.character_name.length)
  const lower = text.toLowerCase()
  const out: MentionPart[] = []
  let i = 0
  let last = 0
  while ((i = text.indexOf('@', i)) !== -1) {
    const hit = sorted.find((p) => lower.startsWith(p.character_name.toLowerCase(), i + 1))
    if (hit) {
      if (i > last) out.push(text.slice(last, i))
      out.push({ player: hit })
      i += 1 + hit.character_name.length
      last = i
    } else {
      i += 1
    }
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** Joueurs mentionnés dans un texte (dédoublonnés). */
export function findMentions(text: string, players: Profile[]): Profile[] {
  const seen = new Set<string>()
  const found: Profile[] = []
  for (const part of splitMentions(text, players)) {
    if (typeof part !== 'string' && !seen.has(part.player.id)) {
      seen.add(part.player.id)
      found.push(part.player)
    }
  }
  return found
}

/** Notifie les joueurs mentionnés dans une lettre ou un commentaire.
   Best-effort : la publication a déjà réussi, un raté de notification
   ne doit pas la faire échouer. */
export async function notifyMentions(p: {
  meId: string
  channel: string
  postId: string
  body: string
}): Promise<void> {
  try {
    const players = await mentionPlayers()
    const targets = findMentions(p.body, players).filter((t) => t.id !== p.meId)
    if (!targets.length) return
    const excerpt = p.body.replace(/\s+/g, ' ').trim().slice(0, 140)
    await supabase.from('notifications').insert(
      targets.map((t) => ({
        profile_id: t.id,
        actor_profile: p.meId,
        kind: 'mention',
        channel: p.channel,
        post_id: p.postId,
        excerpt,
      })),
    )
  } catch (e) {
    console.error('Notification de mention échouée :', e)
  }
}
