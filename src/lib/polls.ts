import { supabase } from './supabase'

/* ============================================================================
   Scrutins par royaume — le Roi ouvre, les membres du royaume votent (une voix).
   Résultats scellés jusqu'à la clôture (compte à rebours), puis révélés à tous.
   ========================================================================== */

export interface PollOption {
  id: string
  label: string
  position: number
}

export interface Poll {
  id: string
  realm: string
  title: string
  description: string
  author_profile: string
  status: 'open' | 'closed'
  closes_at: string
  created_at: string
  is_global: boolean
  is_hrp: boolean
  author?: { character_name: string; house: string } | null
  options: PollOption[]
  /** Les résultats sont-ils révélés (clôture atteinte) ? */
  revealed: boolean
  /** Le scrutin accepte-t-il encore des votes ? */
  open: boolean
  /** Voix par option (clé = id) — fiable seulement si `revealed`. */
  counts: Record<string, number>
  /** Total des voix — fiable seulement si `revealed`. */
  total: number
  /** L'option pour laquelle je me suis prononcé (toujours connue). */
  myChoice: string | null
  hasVoted: boolean
}

function asError(step: string, e: unknown): Error {
  if (e && typeof e === 'object' && 'message' in e) {
    const o = e as { message?: string; code?: string }
    return new Error(`[${step}] ${o.message}${o.code ? ` (${o.code})` : ''}`)
  }
  return new Error(`[${step}] ${String(e)}`)
}

export async function listPolls(meId: string): Promise<Poll[]> {
  const { data, error } = await supabase
    .from('polls')
    .select(
      `id, realm, title, description, author_profile, status, closes_at, created_at, is_global, is_hrp,
       author:profiles!polls_author_profile_fkey(character_name, house),
       options:poll_options(id, label, position),
       votes:poll_votes(option_id, profile_id)`,
    )
    .order('created_at', { ascending: false })
  if (error) throw asError('lecture', error)

  const now = Date.now()
  type Row = Omit<Poll, 'revealed' | 'open' | 'counts' | 'total' | 'myChoice' | 'hasVoted'> & {
    votes: { option_id: string; profile_id: string }[]
  }
  return (data as unknown as Row[]).map((p) => {
    const revealed = p.status === 'closed' || new Date(p.closes_at).getTime() <= now
    const counts: Record<string, number> = {}
    let myChoice: string | null = null
    for (const v of p.votes) {
      counts[v.option_id] = (counts[v.option_id] ?? 0) + 1
      if (v.profile_id === meId) myChoice = v.option_id
    }
    return {
      ...p,
      options: [...p.options].sort((a, b) => a.position - b.position),
      revealed,
      open: p.status === 'open' && new Date(p.closes_at).getTime() > now,
      // Avant révélation, la RLS ne renvoie que MON vote : on n'expose pas de total.
      counts: revealed ? counts : {},
      total: revealed ? p.votes.length : 0,
      myChoice,
      hasVoted: myChoice !== null,
    }
  })
}

export async function createPoll(
  title: string,
  description: string,
  options: string[],
  closesAt: string,
  isGlobal: boolean,
  isHrp: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('create_poll', {
    p_title: title,
    p_description: description,
    p_options: options,
    p_closes_at: closesAt,
    p_global: isGlobal,
    p_hrp: isHrp,
  })
  if (error) throw asError('création', error)
}

export async function castVote(pollId: string, optionId: string, meId: string): Promise<void> {
  const { error } = await supabase
    .from('poll_votes')
    .upsert({ poll_id: pollId, option_id: optionId, profile_id: meId }, { onConflict: 'poll_id,profile_id' })
  if (error) throw asError('vote', error)
}

export async function closePoll(id: string): Promise<void> {
  const { error } = await supabase.from('polls').update({ status: 'closed' }).eq('id', id)
  if (error) throw asError('clôture', error)
}

export async function deletePoll(id: string): Promise<void> {
  const { error } = await supabase.from('polls').delete().eq('id', id)
  if (error) throw asError('suppression', error)
}
