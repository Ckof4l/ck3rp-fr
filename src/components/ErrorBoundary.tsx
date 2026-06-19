import { Component, type ReactNode } from 'react'

/* ============================================================================
   Filet de sécurité : capture les erreurs de rendu. En particulier, après un
   redéploiement, un onglet resté ouvert peut tenter de charger un fichier JS
   qui n'existe plus (nom changé) → l'import échoue → écran noir. On recharge
   alors la page une fois pour récupérer la nouvelle version.
   ========================================================================== */

const CHUNK_RE = /dynamically imported module|Loading chunk|error loading dynamically|importing a module|ChunkLoadError|Failed to fetch/i

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    if (CHUNK_RE.test(String(error?.message || ''))) {
      // Au plus un rechargement automatique toutes les 12 s (évite une boucle).
      const last = Number(sessionStorage.getItem('chunkReloadAt') || 0)
      if (Date.now() - last > 12000) {
        sessionStorage.setItem('chunkReloadAt', String(Date.now()))
        window.location.reload()
      }
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.6 }}>🕯️</div>
            <p className="kicker">Un parchemin s'est déchiré…</p>
            <p style={{ color: '#9C8F71', margin: '8px 0 16px', lineHeight: 1.6 }}>
              Une mise à jour du site vient d'avoir lieu. Recharge la page pour reprendre.
            </p>
            <button className="btn-seal" onClick={() => window.location.reload()}>
              ↻ Recharger
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
