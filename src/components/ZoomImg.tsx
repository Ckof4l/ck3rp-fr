import { useEffect, useState } from 'react'

/* ============================================================================
   Image agrandissable — clic = visionneuse plein écran (clic/Échap pour fermer).
   ========================================================================== */

export function ZoomImg({ src, alt = '', className }: { src: string; alt?: string; className?: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <img
        className={className}
        src={src}
        alt={alt}
        style={{ cursor: 'zoom-in' }}
        onClick={() => setOpen(true)}
      />
      {open && (
        <div className="lightbox" onClick={() => setOpen(false)} role="dialog" aria-modal="true">
          <button className="lightbox-close" aria-label="Fermer" onClick={() => setOpen(false)}>✕</button>
          <img className="lightbox-img" src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  )
}
