import type { ReactNode } from 'react'
import type { Profile } from '../types/database'
import { MentionText } from './MentionText'

/* ============================================================================
   Lettrine enluminée — la première lettre d'une proclamation ou d'une lettre
   importante, façon manuscrit. Passe le texte ; la première lettre est ornée.
   Avec `players`, les « @Nom » du corps sont surlignés (mentions).
   ========================================================================== */

export function Lettrine({ children, players }: { children: string; players?: Profile[] }) {
  const text = children ?? ''
  const first = text.slice(0, 1)
  const rest = text.slice(1)
  return (
    <p style={{ margin: 0 }}>
      <span className="lettrine" aria-hidden="true">
        {first}
      </span>
      {/* La lettre ornée est décorative : on garde le mot complet pour les lecteurs d'écran. */}
      <span className="sr-only">{first}</span>
      {players ? <MentionText text={rest} players={players} /> : rest}
    </p>
  )
}

/* Variante : enlumine juste une lettre fournie, sans corps de texte. */
export function DropCap({ letter, children }: { letter: string; children?: ReactNode }) {
  return (
    <>
      <span className="lettrine">{letter}</span>
      {children}
    </>
  )
}
