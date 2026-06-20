import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

/* ============================================================================
   Nom de personnage cliquable → sa fiche (/personnage/:id).
   Repli en simple texte quand l'id n'est pas disponible (PNJ, inconnu…).
   À utiliser partout où un nom de personnage est affiché.
   ========================================================================== */

export function CharLink({
  id,
  className,
  children,
}: {
  id?: string | null
  className?: string
  children: ReactNode
}) {
  if (!id) return <span className={className}>{children}</span>
  return (
    <Link to={`/personnage/${id}`} className={['charlink', className].filter(Boolean).join(' ')}>
      {children}
    </Link>
  )
}
