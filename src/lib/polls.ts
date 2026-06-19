import { supabase } from './supabase'

/* ============================================================================
   Scrutins — votes des grands événements. Lecture publique, un vote par joueur.
   ========================================================================== */

export interface PollOption {
  id: string
  label: string
  position: number
}

export interface Poll {
  id: string
  title: string
  description: string
  author_profile: string
  status: 'open' | 'closed'
  created_at: string
  author?: { character_name: string; house: string } | null
  options: PollOption[]
  /** Nombre de voix par option (clé = id d'option). */
  counts: Record<string, number>
  total: number
  /** L'option pour laquelle je me suis prononcé (ou null). */
  myChoice: string | null
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
      `id, title, description, author_profile, status, created_at,
       author:profiles!polls_author_profile_fkey(character_name, house),
       options:poll_options(id, label, position),
       votes:poll_votes(option_id, profile_id)`,
    )
    .order('created_at', { ascending: false })
  if (error) throw asError('lecture', error)

  type Row = Omit<Poll, 'counts' | 'total' | 'myChoice'> & {
    votes: { option_id: string; profile_id: string }[]
  }
  return (data as unknown as Row[]).map((p) => {
    const counts: Record<string, number> = {}
    let myChoice: string | null = null
    for (const v of p.votes) {
      counts[v.option_id] = (counts[v.option_id] ?? 0) + 1
      if (v.profile_id === meId) myChoice = v.option_id
    }
    return {
      ...p,
      options: [...p.options].sort((a, b) => a.position - b.position),
      counts,
      total: p.votes.length,
      myChoice,
    }
  })
}

export async function createPoll(title: string, description: string, options: string[]): Promise<void> {
  const { error } = await supabase.rpc('create_poll', {
    p_title: title,
    p_description: description,
    p_options: options,
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
  const { error } = await supabase
    .from('polls')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw asError('clôture', error)
}

export async function deletePoll(id: string): Promise<void> {
  const { error } = await supabase.from('polls').delete().eq('id', id)
  if (error) throw asError('suppression', error)
}
