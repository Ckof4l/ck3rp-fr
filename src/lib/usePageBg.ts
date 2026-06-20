import { useEffect } from 'react'

/* ============================================================================
   Fond de page — applique une scène peinte à la colonne de contenu (même
   mécanisme que les salons de région : variables CSS `--region-bg` /
   `--region-bg-pos` + attribut `data-region`). Si l'image n'existe pas encore,
   rien ne s'affiche (on retombe sur le fond sombre de base).
   ========================================================================== */

export function usePageBg(url: string | null, pos = 'center center') {
  useEffect(() => {
    const el = document.documentElement
    if (url) {
      el.style.setProperty('--region-bg', `url(${url})`)
      el.style.setProperty('--region-bg-pos', pos)
      el.setAttribute('data-region', '')
    }
    return () => {
      el.style.removeProperty('--region-bg')
      el.style.removeProperty('--region-bg-pos')
      el.removeAttribute('data-region')
    }
  }, [url, pos])
}
