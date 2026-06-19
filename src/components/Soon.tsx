/* Écran « Bientôt disponible » — pour les rubriques pas encore ouvertes.
   Garde la navigation et la direction artistique « Le Grimoire ». */

export function Soon({ icon, title, desc }: { icon: string; title: string; desc?: string }) {
  return (
    <section>
      <h2 className="section-h">{icon} {title}</h2>
      <div className="empty" style={{ padding: '52px 24px' }}>
        <div style={{ fontSize: 44, marginBottom: 14, opacity: 0.5 }}>{icon}</div>
        <p className="kicker" style={{ fontSize: 13, letterSpacing: '0.12em' }}>⏳ Bientôt disponible</p>
        <p style={{ color: '#9C8F71', maxWidth: 440, margin: '10px auto 0', lineHeight: 1.6 }}>
          {desc ?? 'Cette rubrique ouvrira prochainement. Patience, le parchemin se prépare…'}
        </p>
      </div>
    </section>
  )
}
