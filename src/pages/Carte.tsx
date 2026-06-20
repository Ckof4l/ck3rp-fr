import { useEffect, useRef, useState, useCallback } from 'react'

/* ============================================================================
   La Carte — carte politique interactive de Westeros (mod AGOT).
   Données pré-calculées dans /public/carte (script tools/agot_map/build_map.py) :
     - political.png : carte colorée par région (palier « empire » de l'AGOT)
     - index.png     : province_id encodé en RGB (R=id&255, G=id>>8) pour le survol
     - map.json      : { meta, regions{clé:{name,color}}, provinces{id:{c,r}} }
   Phase 2 (à venir) : import d'une sauvegarde .ck3 pour colorer par détenteur réel.
   ========================================================================== */

interface RegionInfo { name: string; color: [number, number, number] }
interface ProvInfo { c: string | null; r: string }
interface MapData {
  meta: { width: number; height: number; scale: number }
  regions: Record<string, RegionInfo>
  provinces: Record<string, ProvInfo>
}

/** Régions hors Westeros / techniques à masquer de la légende. */
const HIDE_FROM_LEGEND = new Set([
  'e_ruins', 'e_unknown', 'e_wilderness', 'e_narrow_sea', 'e_daoryrdembos',
])

type Box = { minx: number; miny: number; maxx: number; maxy: number; count: number }

export function Carte() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Données et images chargées (refs : pas de re-render sur le dessin).
  const dataRef = useRef<MapData | null>(null)
  const polRef = useRef<HTMLImageElement | null>(null)
  const idxDataRef = useRef<Uint8ClampedArray | null>(null)
  const boxRef = useRef<Record<string, Box>>({})
  const landBoxRef = useRef<Box | null>(null)
  const highlightRef = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null)

  // Vue (caméra) — en ref pour le dessin, miroir en state pour les boutons.
  const view = useRef({ scale: 1, x: 0, y: 0 })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hover, setHover] = useState<{ region: string; county: string | null; px: number; py: number } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  /* ── Dessin ────────────────────────────────────────────────────────────── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const pol = polRef.current
    if (!canvas || !pol) return
    const ctx = canvas.getContext('2d')!
    const { scale, x, y } = view.current
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingEnabled = false
    ctx.setTransform(scale, 0, 0, scale, x, y)
    ctx.drawImage(pol, 0, 0)
    // Surbrillance de la région active (survol ou sélection).
    const hi = highlightRef.current
    const activeKey = hover?.region ?? selected
    if (hi && activeKey && hi.key === activeKey) {
      ctx.globalAlpha = hover ? 0.34 : 0.22
      ctx.drawImage(hi.canvas, 0, 0)
      ctx.globalAlpha = 1
    }
    ctx.restore()
  }, [hover, selected])

  /* ── Construit (et met en cache) le calque de surbrillance d'une région ── */
  const ensureHighlight = useCallback((key: string) => {
    if (highlightRef.current?.key === key) return
    const data = dataRef.current
    const idx = idxDataRef.current
    if (!data || !idx) return
    const { width: W, height: H } = data.meta
    const off = document.createElement('canvas')
    off.width = W; off.height = H
    const octx = off.getContext('2d')!
    const out = octx.createImageData(W, H)
    const od = out.data
    const prov = data.provinces
    for (let p = 0; p < idx.length; p += 4) {
      const pid = idx[p] + (idx[p + 1] << 8)
      if (!pid) continue
      const info = prov[pid]
      if (info && info.r === key) {
        od[p] = 255; od[p + 1] = 240; od[p + 2] = 200; od[p + 3] = 255
      }
    }
    octx.putImageData(out, 0, 0)
    highlightRef.current = { key, canvas: off }
  }, [])

  /* ── Ajuste la caméra pour cadrer une boîte (image px) dans le canvas ───── */
  const fitTo = useCallback((box: Box, pad = 0.12) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const cw = canvas.width / dpr, ch = canvas.height / dpr
    const bw = box.maxx - box.minx, bh = box.maxy - box.miny
    const s = Math.min(cw / (bw * (1 + pad)), ch / (bh * (1 + pad)))
    const cx = (box.minx + box.maxx) / 2, cy = (box.miny + box.maxy) / 2
    view.current = { scale: s * dpr, x: (cw / 2 - cx * s) * dpr, y: (ch / 2 - cy * s) * dpr }
    draw()
  }, [draw])

  /* ── Chargement initial ────────────────────────────────────────────────── */
  useEffect(() => {
    let alive = true
    const loadImg = (src: string) =>
      new Promise<HTMLImageElement>((res, rej) => {
        const im = new Image()
        im.onload = () => res(im)
        im.onerror = () => rej(new Error(`image ${src}`))
        im.src = src
      })

    ;(async () => {
      try {
        const [data, pol, idxImg] = await Promise.all([
          fetch('/carte/map.json').then((r) => { if (!r.ok) throw new Error('map.json'); return r.json() }),
          loadImg('/carte/political.png'),
          loadImg('/carte/index.png'),
        ])
        if (!alive) return
        dataRef.current = data
        polRef.current = pol

        // Lecture des pixels d'index une fois pour toutes.
        const { width: W, height: H } = data.meta
        const ic = document.createElement('canvas')
        ic.width = W; ic.height = H
        const ictx = ic.getContext('2d', { willReadFrequently: true })!
        ictx.drawImage(idxImg, 0, 0)
        const idxData = ictx.getImageData(0, 0, W, H).data
        idxDataRef.current = idxData

        // Boîtes englobantes par région + boîte des terres (cadrage initial).
        const boxes: Record<string, Box> = {}
        const land: Box = { minx: W, miny: H, maxx: 0, maxy: 0, count: 0 }
        const prov = data.provinces
        for (let p = 0, i = 0; p < idxData.length; p += 4, i++) {
          const pid = idxData[p] + (idxData[p + 1] << 8)
          if (!pid) continue
          const info = prov[pid]
          if (!info) continue
          const x = i % W, y = (i / W) | 0
          const b = boxes[info.r] ?? (boxes[info.r] = { minx: W, miny: H, maxx: 0, maxy: 0, count: 0 })
          if (x < b.minx) b.minx = x; if (x > b.maxx) b.maxx = x
          if (y < b.miny) b.miny = y; if (y > b.maxy) b.maxy = y
          b.count++
          // Cadrage initial : Westeros seulement (on ignore Essos & régions techniques).
          if (!HIDE_FROM_LEGEND.has(info.r)) {
            if (x < land.minx) land.minx = x; if (x > land.maxx) land.maxx = x
            if (y < land.miny) land.miny = y; if (y > land.maxy) land.maxy = y
            land.count++
          }
        }
        boxRef.current = boxes
        landBoxRef.current = land

        setLoading(false)
        requestAnimationFrame(() => { resize(); if (land.count) fitTo(land, 0.06) })
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Redimensionnement du canvas (densité de pixels incluse) ────────────── */
  const resize = useCallback(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current
    if (!canvas || !wrap) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(wrap.clientWidth * dpr)
    canvas.height = Math.floor(wrap.clientHeight * dpr)
    canvas.style.width = wrap.clientWidth + 'px'
    canvas.style.height = wrap.clientHeight + 'px'
    draw()
  }, [draw])

  useEffect(() => {
    const on = () => resize()
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [resize])

  // Redessine quand survol/sélection changent.
  useEffect(() => { draw() }, [draw])

  /* ── Conversion écran → pixel image ────────────────────────────────────── */
  const toImage = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const { scale, x, y } = view.current
    const ix = ((clientX - rect.left) * dpr - x) / scale
    const iy = ((clientY - rect.top) * dpr - y) / scale
    return { ix: Math.floor(ix), iy: Math.floor(iy) }
  }

  const provinceAt = (ix: number, iy: number): ProvInfo | null => {
    const data = dataRef.current, idx = idxDataRef.current
    if (!data || !idx) return null
    const { width: W, height: H } = data.meta
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) return null
    const p = (iy * W + ix) * 4
    const pid = idx[p] + (idx[p + 1] << 8)
    if (!pid) return null
    return data.provinces[pid] ?? null
  }

  /* ── Souris : pan + survol ─────────────────────────────────────────────── */
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null)

  const onDown = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, ox: view.current.x, oy: view.current.y, moved: false }
  }
  const onMove = (e: React.PointerEvent) => {
    if (drag.current) {
      const dpr = window.devicePixelRatio || 1
      const dx = (e.clientX - drag.current.x) * dpr, dy = (e.clientY - drag.current.y) * dpr
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true
      view.current.x = drag.current.ox + dx
      view.current.y = drag.current.oy + dy
      draw()
      return
    }
    const { ix, iy } = toImage(e.clientX, e.clientY)
    const info = provinceAt(ix, iy)
    if (info) {
      if (highlightRef.current?.key !== info.r) ensureHighlight(info.r)
      setHover({ region: info.r, county: info.c, px: e.clientX, py: e.clientY })
    } else if (hover) {
      setHover(null)
    }
  }
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (d && !d.moved) {
      const { ix, iy } = toImage(e.clientX, e.clientY)
      const info = provinceAt(ix, iy)
      if (info) { ensureHighlight(info.r); setSelected(info.r) }
      else setSelected(null)
    }
  }
  const onLeave = () => { if (!drag.current) setHover(null) }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const mx = (e.clientX - rect.left) * dpr, my = (e.clientY - rect.top) * dpr
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    const v = view.current
    const ns = Math.min(Math.max(v.scale * factor, 0.05), 12)
    const k = ns / v.scale
    v.x = mx - (mx - v.x) * k
    v.y = my - (my - v.y) * k
    v.scale = ns
    draw()
  }

  const zoomBtn = (f: number) => {
    const canvas = canvasRef.current!
    const cx = canvas.width / 2, cy = canvas.height / 2
    const v = view.current
    const ns = Math.min(Math.max(v.scale * f, 0.05), 12)
    const k = ns / v.scale
    v.x = cx - (cx - v.x) * k
    v.y = cy - (cy - v.y) * k
    v.scale = ns
    draw()
  }

  const data = dataRef.current
  const regionsList = data
    ? Object.entries(data.regions)
        .filter(([k]) => !HIDE_FROM_LEGEND.has(k))
        .map(([k, v]) => ({ key: k, ...v, count: boxRef.current[k]?.count ?? 0 }))
        .filter((r) => r.count > 0)
        .sort((a, b) => b.count - a.count)
    : []

  const rgb = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`
  const selInfo = selected && data ? data.regions[selected] : null

  return (
    <div className="wrap">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <span className="kicker">Le Royaume</span>
        <h1 style={{ margin: 0 }}>La Carte de Westeros</h1>
      </div>
      <p className="lede" style={{ marginTop: 0, color: 'var(--muted)' }}>
        Carte politique des grandes régions (de jure, mod AGOT). Survole une terre pour la
        révéler, clique pour l'épingler. Molette pour zoomer, glisse pour te déplacer.
      </p>

      {error && (
        <div className="card" style={{ borderColor: 'var(--weirwood)' }}>
          <b>La carte ne s'est pas déployée.</b>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>
            Données manquantes ({error}). Le fichier <code>/carte</code> n'a peut-être pas été généré.
          </p>
        </div>
      )}

      {!error && (
        <div className="carte-grid">
          {/* Carte */}
          <div
            ref={wrapRef}
            className="carte-stage"
            style={{ position: 'relative', touchAction: 'none' }}
          >
            {loading && (
              <div className="empty" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <span className="spinner" /> Déploiement de la carte…
              </div>
            )}
            <canvas
              ref={canvasRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={onLeave}
              onWheel={onWheel}
              style={{ display: 'block', width: '100%', height: '100%', cursor: drag.current ? 'grabbing' : 'crosshair' }}
            />
            {/* Boutons de zoom */}
            <div className="carte-zoom">
              <button onClick={() => zoomBtn(1.3)} aria-label="Zoom avant">＋</button>
              <button onClick={() => zoomBtn(1 / 1.3)} aria-label="Zoom arrière">－</button>
              <button onClick={() => landBoxRef.current && fitTo(landBoxRef.current, 0.06)} aria-label="Vue d'ensemble">⤢</button>
            </div>
            {/* Infobulle de survol */}
            {hover && data && (
              <div
                className="carte-tip"
                style={{ left: hover.px + 14, top: hover.py + 14 }}
              >
                <b>{data.regions[hover.region]?.name ?? hover.region}</b>
                {hover.county && <span> · {hover.county}</span>}
              </div>
            )}
          </div>

          {/* Panneau latéral : sélection + légende */}
          <aside className="carte-side">
            {selInfo ? (
              <div className="card" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 16, height: 16, borderRadius: 3, background: rgb(selInfo.color), boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.4)' }} />
                  <h3 style={{ margin: 0 }}>{selInfo.name}</h3>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                  Détenteur actuel : <i>à venir</i> — l'import d'une sauvegarde de la partie
                  affichera ici le seigneur, son titre et sa maison.
                </p>
                <button className="linkbtn" style={{ marginTop: 8 }} onClick={() => setSelected(null)}>Fermer</button>
              </div>
            ) : (
              <div className="card" style={{ marginBottom: 12, color: 'var(--muted)', fontSize: 13 }}>
                Clique une région sur la carte pour l'épingler ici.
              </div>
            )}

            <div className="side-cat" style={{ marginTop: 0 }}>Les grandes régions</div>
            <div className="carte-legend">
              {regionsList.map((r) => (
                <button
                  key={r.key}
                  className={`carte-leg-item${selected === r.key ? ' on' : ''}`}
                  onMouseEnter={() => { ensureHighlight(r.key); setHover({ region: r.key, county: null, px: -999, py: -999 }) }}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => { setSelected(r.key); const b = boxRef.current[r.key]; if (b) fitTo(b, 0.25) }}
                >
                  <span className="sw" style={{ background: rgb(r.color) }} />
                  <span className="nm">{r.name}</span>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
