import { useState } from 'react'
import { supabaseConfigured } from '../lib/supabase'
import { signInWithDiscord } from '../lib/onboarding'

/* ============================================================================
   La Porte — connexion via Discord uniquement.
   ========================================================================== */

export function Gate() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onDiscord() {
    setError('')
    setBusy(true)
    const { error } = await signInWithDiscord()
    if (error) {
      setBusy(false)
      setError(
        error.toLowerCase().includes('provider')
          ? "La connexion Discord n'est pas encore activée côté serveur (Authentication → Providers → Discord)."
          : error,
      )
    }
    // En cas de succès, Discord redirige puis l'app reprend la main.
  }

  return (
    <Centered>
      <Crest />
      <p className="kicker">La Citadelle · Chancellerie</p>
      <p style={{ color: '#C9BC9D', fontStyle: 'italic', margin: '6px 0 26px', fontSize: 17, lineHeight: 1.5 }}>
        La messagerie scellée des maisons des Sept Royaumes.
        <br />
        Prends ton sceau, et que ta parole s'envole.
      </p>

      {!supabaseConfigured ? (
        <div className="err" style={{ textAlign: 'left' }}>
          <b>La Chancellerie n'est pas encore reliée à la base de données.</b>
          <br />
          Renseigne <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code> dans un fichier{' '}
          <code>.env</code>, puis relance <code>npm run dev</code>.
        </div>
      ) : (
        <>
          {error && <div className="err">{error}</div>}
          <button className="btn-discord" disabled={busy} onClick={onDiscord}>
            <DiscordLogo />
            {busy ? 'Ouverture…' : 'Se connecter avec Discord'}
          </button>
          <p className="hint">
            La connexion se fait avec ton compte <b>Discord</b>. À ta première venue, tu choisiras ton
            personnage et ta maison.
          </p>
        </>
      )}
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="gate-screen">
      <div className="gate-card">
        {children}
        <p style={{ marginTop: 30, color: '#7C715A', fontSize: 12, textAlign: 'center', lineHeight: 1.6 }}>
          Projet de fan, non affilié à Paradox Interactive, HBO ou George R. R. Martin.
        </p>
        <p style={{ marginTop: 6, color: 'var(--gold-dim)', fontSize: 12, textAlign: 'center' }}>
          ✒️ Créé par <b>Falcko</b>
        </p>
      </div>
    </div>
  )
}

function Crest() {
  return <img src="/logo.png" alt="CK3FR RP" className="gate-logo" />
}

function DiscordLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.2.5c1.7.4 2.8 1 3.9 1.7a13.3 13.3 0 0 0-11.9 0c1.1-.7 2.2-1.3 3.9-1.7L10.9 3a19.8 19.8 0 0 0-4.9 1.4C2.9 9 2.1 13.5 2.5 18a20 20 0 0 0 5.5 2.8l.7-1c-.9-.3-1.7-.7-2.5-1.2l.6-.4a14.2 14.2 0 0 0 12.5 0l.6.4c-.8.5-1.6.9-2.5 1.2l.7 1A20 20 0 0 0 23.5 18c.5-5.2-.8-9.7-3.2-13.6ZM9 15.3c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
    </svg>
  )
}
