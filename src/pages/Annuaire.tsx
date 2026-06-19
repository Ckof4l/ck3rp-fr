import { useState } from 'react'
import { Armorial } from './Armorial'
import { Cour } from './Cour'

/* ============================================================================
   Annuaire — réunit l'Armorial (les maisons) et La Cour (les joueurs) en une
   seule rubrique à deux onglets.
   ========================================================================== */

export function Annuaire({ initial = 'armorial' }: { initial?: 'armorial' | 'cour' }) {
  const [tab, setTab] = useState<'armorial' | 'cour'>(initial)
  return (
    <div>
      <div className="subnav">
        <button className={tab === 'armorial' ? 'on' : ''} onClick={() => setTab('armorial')}>
          📜 Armorial
        </button>
        <button className={tab === 'cour' ? 'on' : ''} onClick={() => setTab('cour')}>
          👥 La Cour
        </button>
      </div>
      {tab === 'armorial' ? <Armorial /> : <Cour />}
    </div>
  )
}
