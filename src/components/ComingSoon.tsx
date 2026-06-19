/* Encart « fonction à porter » — marque ce qui sera implémenté aux étapes
   suivantes, sans casser la navigation ni la direction artistique. */

export function ComingSoon({ items }: { items: string[] }) {
  return (
    <div className="card" style={{ marginTop: 18 }}>
      <p style={{ margin: '0 0 10px', color: '#C7B894' }}>
        🪶 <b>À porter depuis l'artefact</b> — fonctions prévues pour cette rubrique :
      </p>
      <ul style={{ margin: 0, paddingLeft: 22, color: '#A99C7E', lineHeight: 1.7 }}>
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    </div>
  )
}
