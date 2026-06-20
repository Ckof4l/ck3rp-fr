import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { HOUSES, FREE_HOUSE_KEY, getHouse, KING_HOUSES } from '../lib/houses'
import { HousePicker } from '../components/HousePicker'
import { takenHouses, completeOnboarding } from '../lib/onboarding'

/* ============================================================================
   Écran d'accueil après la 1ʳᵉ connexion Discord : choix du personnage et
   de la maison.
   ========================================================================== */

export function Onboarding() {
  const { profile, refreshProfile, signOut } = useAuth()
  const [character, setCharacter] = useState('')
  const [charTouched, setCharTouched] = useState(false)
  const [house, setHouse] = useState('stark')
  const [discord, setDiscord] = useState(profile?.discord ?? '')
  const [taken, setTaken] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    takenHouses().then((t) => {
      setTaken(t)
      // Choisit une maison libre par défaut si « stark » est prise.
      setHouse((cur) => (t[cur] && cur !== FREE_HOUSE_KEY ? Object.keys(HOUSES).find((k) => k !== FREE_HOUSE_KEY && !t[k]) ?? FREE_HOUSE_KEY : cur))
    })
  }, [])

  function pick(k: string) {
    if (taken[k] && k !== FREE_HOUSE_KEY) return
    setHouse(k)
    if (!charTouched) setCharacter(HOUSES[k].canon)
  }

  async function submit() {
    if (!character.trim()) return setError('Donne un nom à ton personnage.')
    if (!discord.trim()) return setError('Indique ton pseudo Discord.')
    if (house !== FREE_HOUSE_KEY && taken[house]) {
      return setError(`La maison ${HOUSES[house].nom} est déjà tenue par ${taken[house]}.`)
    }
    setBusy(true)
    setError('')
    try {
      await completeOnboarding(character, house, discord)
      await refreshProfile()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La finalisation a échoué.')
      setBusy(false)
    }
  }

  return (
    <div className="gate-screen">
      <div className="gate-card">
        <img src="/logo.png" alt="CK3FR RP" className="gate-logo" />
        <p className="kicker">Bienvenue dans les Sept Royaumes</p>
        <p style={{ color: '#C9BC9D', fontStyle: 'italic', margin: '6px 0 22px', fontSize: 16, lineHeight: 1.5 }}>
          Encore un pas avant de prêter serment : choisis ton personnage et ta maison.
        </p>

        {error && <div className="err">{error}</div>}

        <div className="field">
          <label>Ton personnage</label>
          <input
            className="input"
            value={character}
            onChange={(e) => { setCharacter(e.target.value); setCharTouched(true) }}
            placeholder="ex. Lord Brandon Stark"
          />
        </div>

        <div className="field">
          <label>Pseudo Discord</label>
          <input className="input" value={discord} onChange={(e) => setDiscord(e.target.value)} placeholder="ton pseudo Discord" />
        </div>

        <div className="field">
          <label>Ta maison</label>
          <HousePicker selected={house} taken={taken} onPick={pick} />
          {KING_HOUSES.has(house) && (
            <p className="hint" style={{ color: 'var(--gold)' }}>
              👑 En tenant cette grande maison régnante, tu seras nommé <b>Roi</b>.
            </p>
          )}
          <p className="hint">
            Une maison ne peut être tenue que par un seul joueur. « {getHouse(FREE_HOUSE_KEY).nom} » reste ouverte à tous.
          </p>
        </div>

        <button className="btn-seal block" disabled={busy} onClick={submit}>
          {busy ? 'Scellage…' : 'Prêter serment'}
        </button>
        <button className="linkbtn" style={{ marginTop: 10 }} onClick={signOut}>
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
