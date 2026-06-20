import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getHouse, rkStyle } from '../lib/houses'
import { fmtDate } from '../lib/format'
import { Seal } from '../components/Seal'
import { HelpCard } from '../components/HelpCard'
import {
  rebirth,
  listMyGraveyard,
  listRealmGraveyard,
  deleteMyAccount,
  type Grave,
} from '../lib/destin'

/* ============================================================================
   Mon destin — mort & renaissance (même maison, nouveau prénom) + nécrologie.
   ========================================================================== */

export function Destin() {
  const { profile, refreshProfile, signOut } = useAuth()
  const meId = profile!.id
  const h = getHouse(profile?.house)

  const [deathOpen, setDeathOpen] = useState(false)
  const [cause, setCause] = useState('')
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [mine, setMine] = useState<Grave[]>([])
  const [realm, setRealm] = useState<Grave[]>([])

  const loadGraves = useCallback(async () => {
    const [m, r] = await Promise.all([listMyGraveyard(meId), listRealmGraveyard()])
    setMine(m)
    setRealm(r)
  }, [meId])

  useEffect(() => {
    loadGraves()
  }, [loadGraves])

  async function applyDeath() {
    if (!newName.trim()) {
      setStatus('Donne un prénom à ton nouveau personnage.')
      return
    }
    setBusy(true)
    setStatus('')
    try {
      await rebirth({
        meId,
        oldCharacter: profile!.character_name,
        house: profile!.house,
        cause,
        newName,
      })
      await refreshProfile()
      await loadGraves()
      setDeathOpen(false)
      setCause('')
      setNewName('')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'La renaissance a échoué.')
    } finally {
      setBusy(false)
    }
  }

  async function removeAccount() {
    if (!confirm('Supprimer DÉFINITIVEMENT ton compte et toutes tes données ? Ta maison sera libérée. Cette action est irréversible.')) return
    if (!confirm('Dernière confirmation : on efface vraiment tout ?')) return
    try {
      await deleteMyAccount()
      await signOut()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Suppression impossible.')
    }
  }

  return (
    <section>
      <h2 className="section-h">Mon destin</h2>

      <HelpCard id="destin" title="Mon destin — comment ça marche ?">
        Ici, tu gères la vie et la mort de ton personnage.
        <ul>
          <li>Clique <b>⚰️ Déclarer la mort</b> quand ton personnage meurt (au combat, de vieillesse, assassiné…).</li>
          <li>Tu <b>restes dans ta maison</b> : tu choisis juste le <b>prénom</b> de ton nouveau personnage (un héritier, un cousin…).</li>
          <li>L'ancien rejoint <b>la nécrologie du royaume</b> et tes « personnages tombés ».</li>
          <li>Tout en bas, tu peux <b>supprimer ton compte</b> (RGPD) : ça efface tes données et libère ta maison. Irréversible.</li>
        </ul>
      </HelpCard>

      {/* Personnage actuel */}
      <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <Seal house={profile?.house} size="xl" />
        <div>
          <div style={{ fontFamily: 'var(--display)', fontSize: 22, color: 'var(--parch)' }}>
            {profile?.character_name}
          </div>
          <div style={{ color: '#9C8F71', fontSize: 13, marginTop: 2 }}>
            Maison {h.nom} · {h.region} · en vie depuis le {fmtDate(profile!.reborn_at)}
          </div>
        </div>
        {!deathOpen && (
          <button className="btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setDeathOpen(true)}>
            ⚰️ Déclarer la mort de ce personnage
          </button>
        )}
      </div>

      {/* Formulaire de mort / renaissance */}
      {deathOpen && (
        <div className="death-form">
          <h3>⚰️ {profile?.character_name} n'est plus — un nouveau prend la plume</h3>
          <p className="hint" style={{ marginTop: 0 }}>
            Tu restes de la <b>Maison {h.nom}</b> : seul ton personnage change. Choisis son nouveau prénom.
          </p>
          <div className="field">
            <label>Cause de la mort (facultatif)</label>
            <input
              className="input"
              value={cause}
              onChange={(e) => setCause(e.target.value)}
              placeholder="ex. Tombé à la bataille du Trident"
            />
          </div>
          <div className="field">
            <label>Nom de ton nouveau personnage</label>
            <input
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`ex. un nouvel héritier de la Maison ${h.nom}`}
              autoFocus
            />
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn-seal" disabled={busy} onClick={applyDeath}>
              ⚰️ Sceller le destin &amp; renaître
            </button>
            <button className="btn-ghost" disabled={busy} onClick={() => setDeathOpen(false)}>
              Annuler
            </button>
            {status && <span className="sent-ok" style={{ color: '#E7A79F' }}>{status}</span>}
          </div>
        </div>
      )}

      {/* Tes personnages tombés */}
      <h3 className="section-h" style={{ fontSize: 12, marginTop: 26 }}>
        Tes personnages tombés
      </h3>
      {mine.length ? (
        <GraveList graves={mine} />
      ) : (
        <div className="empty" style={{ padding: 26 }}>Aucun de tes personnages n'est encore tombé.</div>
      )}

      {/* Nécrologie du royaume */}
      <h3 className="section-h" style={{ fontSize: 12, marginTop: 28 }}>
        ⚱️ Nécrologie du royaume
      </h3>
      {realm.length ? (
        <GraveList graves={realm} />
      ) : (
        <div className="empty" style={{ padding: 26 }}>Nul n'est encore tombé dans les Sept Royaumes.</div>
      )}

      {/* RGPD */}
      <div className="danger-zone" style={{ marginTop: 34 }}>
        <h3 className="section-h" style={{ fontSize: 12, color: '#E7A79F', marginBottom: 10 }}>
          Quitter le jeu (RGPD)
        </h3>
        <p style={{ color: '#A99C7E', fontSize: 14, lineHeight: 1.55, margin: '0 0 14px' }}>
          Supprime <b>définitivement</b> ton compte et toutes tes données (personnage, posts, corbeaux…).
          Ta maison redevient libre. Irréversible.
        </p>
        <button className="tiny danger" onClick={removeAccount}>
          🚪 Supprimer mon compte
        </button>
      </div>
    </section>
  )
}

function GraveList({ graves }: { graves: Grave[] }) {
  return (
    <div className="ravens">
      {graves.map((g) => {
        const gh = getHouse(g.house)
        return (
          <div key={g.id} className="grave-row" style={rkStyle(g.house)}>
            <Seal house={g.house} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#C7B894', fontSize: 15 }}>
                {g.character_name} <span style={{ color: '#8E8268' }}>— Maison {gh.nom}</span>
              </div>
              {g.cause && <div style={{ color: '#8E8268', fontSize: 13, fontStyle: 'italic' }}>« {g.cause} »</div>}
            </div>
            <div style={{ color: '#8E8268', fontSize: 12, flex: 'none' }}>✝ {fmtDate(g.died_at)}</div>
          </div>
        )
      })}
    </div>
  )
}
