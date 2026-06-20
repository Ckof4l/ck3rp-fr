import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { playerRealm } from '../lib/channels'
import { getHouse } from '../lib/houses'

/* Correspondance clé de salon régional du site → grande région (empire) de la carte. */
const SITE_TO_REGION: Record<string, string> = {
  'le-nord': 'e_the_north',
  'le-val': 'e_the_vale',
  'le-roc': 'e_the_westerlands',
  'le-trident': 'e_the_riverlands',
  'le-bief': 'e_the_reach',
  'dorne': 'e_dorne',
  'les-iles-de-fer': 'e_the_iron_islands',
  'peyredragon': 'e_the_crownlands',
}

interface SitePlayer { name: string; house: string; king: boolean }

/* ============================================================================
   La Carte — carte politique interactive de Westeros (mod AGOT).
   Deux calques :
     • « De jure » : les grandes régions figées du mod (public/carte/map.json + political.png)
     • « Partie »  : l'état réel d'une sauvegarde — frontières DE FACTO, détenteurs et
                     statistiques (public/carte/save.json + political_save.png), généré par
                     tools/agot_map/build_save_state.py à partir d'un fichier .ck3.
   Hit-test commun via index.png (province_id encodé R+G*256).
   ========================================================================== */

interface RegionInfo { name: string; color: [number, number, number]; ruler?: string | null; lords?: { name: string; title: string }[] }
interface DeJureProv { c: string | null; ck: string | null; r: string }
interface SaveProv { realm: string; holder: string | null }
interface MapData { meta: { width: number; height: number }; regions: Record<string, RegionInfo>; provinces: Record<string, DeJureProv> }
interface SaveData {
  meta: { date: string; player: string; characters: number; houses: number; realms: number; titled: number }
  regions: Record<string, RegionInfo>
  provinces: Record<string, SaveProv>
}

type Box = { minx: number; miny: number; maxx: number; maxy: number; count: number }

/** Régions hors Westeros / techniques masquées de la légende « de jure ». */
const HIDE_FROM_LEGEND = new Set(['e_ruins', 'e_unknown', 'e_wilderness', 'e_narrow_sea', 'e_daoryrdembos'])

interface Layer {
  pol: HTMLImageElement
  regions: Record<string, RegionInfo>
  provKey: (pid: number) => string | null
  holder: (pid: number) => string | null
  boxes: Record<string, Box>
  landBox: Box
  hideKeys: Set<string>
}

export function Carte() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const idxDataRef = useRef<Uint8ClampedArray | null>(null)
  const dimRef = useRef({ W: 0, H: 0 })
  const layersRef = useRef<{ dejure: Layer | null; save: Layer | null }>({ dejure: null, save: null })
  const saveMetaRef = useRef<SaveData['meta'] | null>(null)
  const highlightRef = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null)

  const view = useRef({ scale: 1, x: 0, y: 0 })

  const [mode, setMode] = useState<'dejure' | 'save'>('dejure')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasSave, setHasSave] = useState(false)
  const [, force] = useState(0)
  const [hover, setHover] = useState<{ region: string; sub: string | null; px: number; py: number } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [players, setPlayers] = useState<Record<string, SitePlayer[]>>({})

  const layer = (): Layer | null => layersRef.current[mode]

  /* ── Dessin ────────────────────────────────────────────────────────────── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const L = layersRef.current[mode]
    if (!canvas || !L) return
    const ctx = canvas.getContext('2d')!
    const { scale, x, y } = view.current
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingEnabled = false
    ctx.setTransform(scale, 0, 0, scale, x, y)
    ctx.drawImage(L.pol, 0, 0)
    const hi = highlightRef.current
    const activeKey = hover?.region ?? selected
    if (hi && activeKey && hi.key === activeKey) {
      ctx.globalAlpha = hover ? 0.34 : 0.22
      ctx.drawImage(hi.canvas, 0, 0)
      ctx.globalAlpha = 1
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }, [mode, hover, selected])

  /* ── Calque de surbrillance d'une région du calque actif ───────────────── */
  const ensureHighlight = useCallback((key: string) => {
    if (highlightRef.current?.key === key) return
    const idx = idxDataRef.current
    const L = layersRef.current[mode]
    if (!idx || !L) return
    const { W, H } = dimRef.current
    const off = document.createElement('canvas')
    off.width = W; off.height = H
    const octx = off.getContext('2d')!
    const out = octx.createImageData(W, H)
    const od = out.data
    for (let p = 0; p < idx.length; p += 4) {
      const pid = idx[p] + (idx[p + 1] << 8)
      if (!pid) continue
      if (L.provKey(pid) === key) {
        od[p] = 255; od[p + 1] = 240; od[p + 2] = 200; od[p + 3] = 255
      }
    }
    octx.putImageData(out, 0, 0)
    highlightRef.current = { key, canvas: off }
  }, [mode])

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

  /* ── Construit un calque (boîtes par région via un balayage d'index) ───── */
  const buildLayer = useCallback((
    pol: HTMLImageElement,
    regions: Record<string, RegionInfo>,
    provKey: (pid: number) => string | null,
    holder: (pid: number) => string | null,
    hideKeys: Set<string>,
  ): Layer => {
    const idx = idxDataRef.current!
    const { W, H } = dimRef.current
    const boxes: Record<string, Box> = {}
    const land: Box = { minx: W, miny: H, maxx: 0, maxy: 0, count: 0 }
    for (let p = 0, i = 0; p < idx.length; p += 4, i++) {
      const pid = idx[p] + (idx[p + 1] << 8)
      if (!pid) continue
      const k = provKey(pid)
      if (!k) continue
      const x = i % W, y = (i / W) | 0
      const b = boxes[k] ?? (boxes[k] = { minx: W, miny: H, maxx: 0, maxy: 0, count: 0 })
      if (x < b.minx) b.minx = x; if (x > b.maxx) b.maxx = x
      if (y < b.miny) b.miny = y; if (y > b.maxy) b.maxy = y
      b.count++
      if (!hideKeys.has(k)) {
        if (x < land.minx) land.minx = x; if (x > land.maxx) land.maxx = x
        if (y < land.miny) land.miny = y; if (y > land.maxy) land.maxy = y
        land.count++
      }
    }
    return { pol, regions, provKey, holder, boxes, landBox: land, hideKeys }
  }, [])

  /* ── Chargement initial ────────────────────────────────────────────────── */
  useEffect(() => {
    let alive = true
    const loadImg = (src: string) =>
      new Promise<HTMLImageElement>((res, rej) => {
        const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error(src)); im.src = src
      })

    ;(async () => {
      try {
        const [data, pol, idxImg] = await Promise.all([
          fetch('/carte/map.json').then((r) => { if (!r.ok) throw new Error('map.json'); return r.json() as Promise<MapData> }),
          loadImg('/carte/political.png'),
          loadImg('/carte/index.png'),
        ])
        if (!alive) return
        const W = data.meta.width, H = data.meta.height
        dimRef.current = { W, H }

        const ic = document.createElement('canvas'); ic.width = W; ic.height = H
        const ictx = ic.getContext('2d', { willReadFrequently: true })!
        ictx.drawImage(idxImg, 0, 0)
        idxDataRef.current = ictx.getImageData(0, 0, W, H).data

        layersRef.current.dejure = buildLayer(
          pol, data.regions,
          (pid) => data.provinces[pid]?.r ?? null,
          () => null,
          HIDE_FROM_LEGEND,
        )
        setLoading(false)
        requestAnimationFrame(() => { resize(); const lb = layersRef.current.dejure!.landBox; if (lb.count) fitTo(lb, 0.06) })

        // Calque « partie » (facultatif : présent seulement si une save a été importée).
        try {
          const [sdata, spol] = await Promise.all([
            fetch('/carte/save.json').then((r) => { if (!r.ok) throw new Error('no save'); return r.json() as Promise<SaveData> }),
            loadImg('/carte/political_save.png'),
          ])
          if (!alive) return
          saveMetaRef.current = sdata.meta
          layersRef.current.save = buildLayer(
            spol, sdata.regions,
            (pid) => sdata.provinces[pid]?.realm ?? null,
            (pid) => sdata.provinces[pid]?.holder ?? null,
            new Set(),
          )
          setHasSave(true)
          setMode('save')  // l'an 1 après le Fléau est la vue principale
        } catch { /* pas de save importée : seul le calque de jure existe */ }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Changement de calque : on réinitialise surbrillance/sélection et on recadre.
  useEffect(() => {
    highlightRef.current = null
    setHover(null); setSelected(null)
    const L = layersRef.current[mode]
    if (L) { draw(); if (L.landBox.count) fitTo(L.landBox, 0.06) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  useEffect(() => { draw() }, [draw])

  // Joueurs du site rangés par grande région (d'après la maison de chaque profil).
  useEffect(() => {
    let alive = true
    supabase
      .from('profiles')
      .select('character_name, house, is_king')
      .eq('onboarded', true)
      .then(({ data }) => {
        if (!alive || !data) return
        const by: Record<string, SitePlayer[]> = {}
        for (const p of data as { character_name: string; house: string; is_king: boolean }[]) {
          const sk = playerRealm({ house: p.house } as never)
          const rk = sk ? SITE_TO_REGION[sk] : null
          if (!rk) continue
          ;(by[rk] ??= []).push({ name: p.character_name, house: p.house, king: !!p.is_king })
        }
        for (const k of Object.keys(by)) by[k].sort((a, b) => Number(b.king) - Number(a.king))
        setPlayers(by)
      })
    return () => { alive = false }
  }, [])

  const toImage = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const { scale, x, y } = view.current
    return { ix: Math.floor(((clientX - rect.left) * dpr - x) / scale), iy: Math.floor(((clientY - rect.top) * dpr - y) / scale) }
  }
  const pidAt = (ix: number, iy: number): number => {
    const idx = idxDataRef.current
    const { W, H } = dimRef.current
    if (!idx || ix < 0 || iy < 0 || ix >= W || iy >= H) return 0
    const p = (iy * W + ix) * 4
    return idx[p] + (idx[p + 1] << 8)
  }

  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null)
  const onDown = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, ox: view.current.x, oy: view.current.y, moved: false }
    force((n) => n + 1)
  }
  const onMove = (e: React.PointerEvent) => {
    const L = layer()
    if (drag.current) {
      const dpr = window.devicePixelRatio || 1
      const dx = (e.clientX - drag.current.x) * dpr, dy = (e.clientY - drag.current.y) * dpr
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true
      view.current.x = drag.current.ox + dx
      view.current.y = drag.current.oy + dy
      draw()
      return
    }
    if (!L) return
    const { ix, iy } = toImage(e.clientX, e.clientY)
    const pid = pidAt(ix, iy)
    const k = pid ? L.provKey(pid) : null
    if (k) {
      if (highlightRef.current?.key !== k) ensureHighlight(k)
      setHover({ region: k, sub: mode === 'save' ? L.holder(pid) : null, px: e.clientX, py: e.clientY })
    } else if (hover) setHover(null)
  }
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = null; force((n) => n + 1)
    const L = layer()
    if (d && !d.moved && L) {
      const { ix, iy } = toImage(e.clientX, e.clientY)
      const pid = pidAt(ix, iy)
      const k = pid ? L.provKey(pid) : null
      if (k) { ensureHighlight(k); setSelected(k) } else setSelected(null)
    }
  }
  const onLeave = () => { if (!drag.current) setHover(null) }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const rect = canvasRef.current!.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const mx = (e.clientX - rect.left) * dpr, my = (e.clientY - rect.top) * dpr
    const v = view.current
    const ns = Math.min(Math.max(v.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 0.05), 12)
    const k = ns / v.scale
    v.x = mx - (mx - v.x) * k; v.y = my - (my - v.y) * k; v.scale = ns
    draw()
  }
  const zoomBtn = (f: number) => {
    const canvas = canvasRef.current!
    const cx = canvas.width / 2, cy = canvas.height / 2, v = view.current
    const ns = Math.min(Math.max(v.scale * f, 0.05), 12), k = ns / v.scale
    v.x = cx - (cx - v.x) * k; v.y = cy - (cy - v.y) * k; v.scale = ns
    draw()
  }

  const L = layer()
  const rgb = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`
  const regionsList = L
    ? Object.entries(L.regions)
        .filter(([k]) => !L.hideKeys.has(k))
        .map(([k, v]) => ({ key: k, ...v, count: L.boxes[k]?.count ?? 0 }))
        .filter((r) => r.count > 0)
        .sort((a, b) => b.count - a.count)
    : []
  const selInfo = selected && L ? L.regions[selected] : null
  const sm = saveMetaRef.current

  return (
    <div className="wrap">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
        <span className="kicker">Le Royaume</span>
        <h1 style={{ margin: 0 }}>La Carte de Westeros</h1>
      </div>

      {/* Bascule de calque — l'an 1 après le Fléau (la partie) est la vue principale */}
      <div className="carte-modes">
        <button className={mode === 'save' ? 'on' : ''} disabled={!hasSave} onClick={() => setMode('save')}>
          ⚔️ An 1 après le Fléau
        </button>
        <button className={mode === 'dejure' ? 'on' : ''} onClick={() => setMode('dejure')}>Grandes régions</button>
      </div>

      {mode === 'save' && sm && (
        <div className="carte-stats">
          <span>👤 {sm.player}</span>
          <span>👥 {sm.characters.toLocaleString('fr-FR')} personnages</span>
          <span>🛡️ {sm.houses.toLocaleString('fr-FR')} maisons</span>
          <span>🏰 {sm.realms} royaumes</span>
          <span>⚔️ {sm.titled.toLocaleString('fr-FR')} titres détenus</span>
        </div>
      )}
      <p className="lede" style={{ margin: '4px 0 10px', color: 'var(--muted)' }}>
        {mode === 'dejure'
          ? 'Les grandes régions de jure du mod AGOT. Survole une terre, clique pour l’épingler. Molette : zoom · glisser : déplacer.'
          : 'Frontières réelles de la partie (de facto). Survole une terre pour voir son seigneur, clique pour l’épingler.'}
      </p>

      {error && (
        <div className="card" style={{ borderColor: 'var(--weirwood)' }}>
          <b>La carte ne s'est pas déployée.</b>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>Données manquantes ({error}).</p>
        </div>
      )}

      {!error && (
        <div className="carte-grid">
          <div ref={wrapRef} className="carte-stage" style={{ position: 'relative', touchAction: 'none' }}>
            {loading && (
              <div className="empty" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <span className="spinner" /> Déploiement de la carte…
              </div>
            )}
            <canvas
              ref={canvasRef}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onLeave} onWheel={onWheel}
              style={{ display: 'block', width: '100%', height: '100%', cursor: drag.current ? 'grabbing' : 'crosshair' }}
            />
            <div className="carte-zoom">
              <button onClick={() => zoomBtn(1.3)} aria-label="Zoom avant">＋</button>
              <button onClick={() => zoomBtn(1 / 1.3)} aria-label="Zoom arrière">－</button>
              <button onClick={() => L && fitTo(L.landBox, 0.06)} aria-label="Vue d'ensemble">⤢</button>
            </div>
            {hover && L && hover.px > -500 && (
              <div className="carte-tip" style={{ left: hover.px + 14, top: hover.py + 14 }}>
                <b>{L.regions[hover.region]?.name ?? hover.region}</b>
                {hover.sub && <span> · {hover.sub}</span>}
              </div>
            )}
          </div>

          <aside className="carte-side">
            {selInfo ? (
              <div className="card" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 16, height: 16, borderRadius: 3, background: rgb(selInfo.color), boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.4)' }} />
                  <h3 style={{ margin: 0 }}>{selInfo.name}</h3>
                </div>
                {mode === 'save' ? (
                  <>
                    <p style={{ margin: '8px 0 2px', fontSize: 13, color: 'var(--parch)' }}>
                      Souverain : <b>{selInfo.ruler || '—'}</b>
                    </p>
                    {selInfo.lords && selInfo.lords.length > 0 && (
                      <>
                        <div className="side-cat" style={{ margin: '8px 0 4px' }}>Seigneurs ({selInfo.lords.length})</div>
                        <ul className="carte-lords">
                          {selInfo.lords.map((l, i) => (
                            <li key={i}><span className="ln">{l.name}</span><span className="lt">{l.title}</span></li>
                          ))}
                        </ul>
                      </>
                    )}
                  </>
                ) : selected && players[selected]?.length ? (
                  <>
                    <div className="side-cat" style={{ margin: '8px 0 4px' }}>Joueurs ici ({players[selected].length})</div>
                    <ul className="carte-lords">
                      {players[selected].map((p, i) => (
                        <li key={i}>
                          <span className="ln">{p.king ? '👑 ' : ''}{p.name}</span>
                          <span className="lt">Maison {getHouse(p.house).nom}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                    Aucun joueur du site dans cette région. Bascule sur « La partie » pour voir les seigneurs de la save.
                  </p>
                )}
                <button className="linkbtn" style={{ marginTop: 8 }} onClick={() => setSelected(null)}>Fermer</button>
              </div>
            ) : (
              <div className="card" style={{ marginBottom: 12, color: 'var(--muted)', fontSize: 13 }}>
                Clique une région sur la carte pour l'épingler ici.
              </div>
            )}

            <div className="side-cat" style={{ marginTop: 0 }}>
              {mode === 'dejure' ? 'Les grandes régions' : `Royaumes (${regionsList.length})`}
            </div>
            <div className="carte-legend">
              {regionsList.map((r) => (
                <button
                  key={r.key}
                  className={`carte-leg-item${selected === r.key ? ' on' : ''}`}
                  onMouseEnter={() => { ensureHighlight(r.key); setHover({ region: r.key, sub: null, px: -999, py: -999 }) }}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => { setSelected(r.key); const b = L?.boxes[r.key]; if (b) fitTo(b, 0.25) }}
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
