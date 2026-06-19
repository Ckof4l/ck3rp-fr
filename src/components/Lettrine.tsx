import type { ReactNode } from 'react'

/* ============================================================================
   Lettrine enluminée — la première lettre d'une proclamation ou d'une lettre
   importante, façon manuscrit. Passe le texte ; la première lettre est ornée.
   ========================================================================== */

export function Lettrine({ children }: { children: string }) {
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
      {rest}
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
