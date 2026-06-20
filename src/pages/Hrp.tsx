import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { listPlayers } from '../lib/directory'
import { getGlobalConversation, type Conversation } from '../lib/conversations'
import type { Profile } from '../types/database'
import { ConversationView } from './Conversations'

/* ============================================================================
   Salon HRP — le chat hors-roleplay global, ouvert à tous, en temps réel.
   ========================================================================== */

export function Hrp() {
  const { profile } = useAuth()
  const [conv, setConv] = useState<Conversation | null>(null)
  const [players, setPlayers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getGlobalConversation().then((c) => { setConv(c); setLoading(false) })
    listPlayers().then(setPlayers)
  }, [])

  if (loading) return <div className="empty">Ouverture du salon HRP…</div>
  if (!conv) return <div className="empty">Le salon HRP n'est pas encore initialisé (migration 0036).</div>

  return (
    <div>
      <p className="channel-desc" style={{ marginTop: 0 }}>
        💬 Discussion <b>hors-roleplay</b> : organisation, questions, papotage. Ouvert à tous, en temps réel.
      </p>
      <ConversationView
        conv={conv}
        meId={profile!.id}
        players={players}
        canWrite={!profile?.is_observer}
        isAdmin={!!profile?.is_admin}
      />
    </div>
  )
}
