import { useAuth } from '../context/AuthContext'
import { fmtDate } from '../lib/format'

/* ============================================================================
   Écran de bannissement — affiché quand le compte Discord connecté est banni.
   ========================================================================== */

export function Banned() {
  const { ban, signOut } = useAuth()
  return (
    <div className="gate-screen">
      <div className="gate-card">
        <div style={{ fontSize: 46, marginBottom: 10 }}>🚫</div>
        <p className="kicker">Accès révoqué</p>
        <h2 style={{ fontFamily: 'var(--display)', color: 'var(--parch)', margin: '6px 0 14px' }}>
          Tu as été banni de la Citadelle
        </h2>
        <p style={{ color: '#C9BC9D', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 18 }}>
          Les portes te sont closes. Si tu penses qu'il s'agit d'une erreur, contacte un Mestre sur Discord.
        </p>
        {ban?.reason && (
          <div className="err" style={{ textAlign: 'left', marginBottom: 18 }}>
            <b>Motif :</b> {ban.reason}
          </div>
        )}
        {ban?.banned_at && (
          <p className="hint" style={{ marginBottom: 18 }}>Banni le {fmtDate(ban.banned_at)}.</p>
        )}
        <button className="btn-ghost" onClick={signOut}>Se déconnecter</button>
      </div>
    </div>
  )
}
