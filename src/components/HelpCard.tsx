import { useState, type ReactNode } from 'react'

/* ============================================================================
   Encart d'aide repliable (« tuto ») — explique une rubrique. Se souvient
   de l'état ouvert/fermé par section (localStorage).
   ========================================================================== */

export function HelpCard({
  id,
  title = 'Comment ça marche ?',
  children,
}: {
  id: string
  title?: string
  children: ReactNode
}) {
  const key = 'help:' + id
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(key) !== 'closed'
    } catch {
      return true
    }
  })

  function toggle() {
    const next = !open
    setOpen(next)
    try {
      localStorage.setItem(key, next ? 'open' : 'closed')
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="help-card">
      <button className="help-head" onClick={toggle} aria-expanded={open}>
        <span>💡 {title}</span>
        <span className="help-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="help-body">{children}</div>}
    </div>
  )
}
