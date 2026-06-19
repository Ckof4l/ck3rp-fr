/** Date courte façon « 12 mars · 14:30 ». */
export function fmtDate(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
    ' · ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  )
}
