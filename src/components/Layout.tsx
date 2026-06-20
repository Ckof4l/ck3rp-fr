import { useState, useEffect, type ReactNode } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useUnread } from '../context/UnreadContext'
import { getHouse } from '../lib/houses'
import { channelsByCategory } from '../lib/channels'
import { supabase } from '../lib/supabase'
import { getAnnouncement } from '../lib/realm'
import { Seal } from './Seal'

function Banner() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    getAnnouncement().then((a) => setMsg(a?.message ?? null))
    const ch = supabase
      .channel('announce')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () =>
        getAnnouncement().then((a) => setMsg(a?.message ?? null)),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [])
  if (!msg) return null
  return <div className="site-banner">📢 {msg}</div>
}

/* ============================================================================
   Coquille du site — barre du haut (marque + joueur) + barre latérale type
   Discord (Corbeaux, Décrets, Le Royaume, La Cour) + contenu + pied légal.
   ========================================================================== */

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="wordmark">
      <img src="/logo.png" alt="" width={compact ? 32 : 40} height={compact ? 32 : 40} />
      <span>CK3FR&nbsp;RP</span>
    </Link>
  )
}

function SideLink({
  to,
  icon,
  seal,
  img,
  ico,
  label,
  onClick,
  badge = 0,
  soon = false,
}: {
  to: string
  icon?: string
  seal?: string
  img?: string
  ico?: string
  label: string
  onClick: () => void
  badge?: number
  soon?: boolean
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => `side-link${isActive ? ' on' : ''}${soon ? ' soon' : ''}`}
    >
      {ico ? (
        <img
          className="nav-ico"
          src={ico}
          alt=""
          onError={(e) => {
            e.currentTarget.outerHTML = `<span class="si">${icon ?? '📜'}</span>`
          }}
        />
      ) : img ? (
        <span className="seal sm">
          <img
            className="seal-img"
            src={img}
            alt=""
            onError={(e) => {
              const span = e.currentTarget.parentElement
              if (span) span.outerHTML = `<span class="si">${icon ?? '📜'}</span>`
            }}
          />
        </span>
      ) : seal ? (
        <Seal house={seal} size="sm" />
      ) : (
        <span className="si">{icon}</span>
      )}
      <span className="sl">{label}</span>
      {soon && <span className="soon-tag">bientôt</span>}
      {!soon && badge > 0 && <span className="side-badge">{badge > 99 ? '99+' : badge}</span>}
    </NavLink>
  )
}

function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const { profile } = useAuth()
  const { counts, corbeaux, tickets } = useUnread()
  const cats = channelsByCategory()
  return (
    <nav className="side-nav">
      <div className="side-cat">Messages</div>
      <SideLink to="/chancellerie" icon="🐦‍⬛" ico="/icons/corbeaux.png?v=2" label="Corbeaux" onClick={onNavigate} badge={corbeaux} />
      <SideLink to="/conversations" icon="💬" ico="/icons/conversations.png?v=2" label="Conversations" onClick={onNavigate} />
      <SideLink to="/hrp" icon="🗨️" ico="/icons/hrp.png?v=2" label="Salon HRP" onClick={onNavigate} />

      {cats.map(({ category, channels }) => (
        <div key={category}>
          <div className="side-cat">{category}</div>
          {channels.map((c) => (
            <SideLink
              key={c.key}
              to={`/c/${c.key}`}
              icon={c.icon}
              img={c.kind === 'region' ? `/blasons/regions/${c.key}.png?v=4` : undefined}
              ico={c.kind === 'region' ? undefined : `/icons/${c.key}.png?v=2`}
              label={c.name}
              onClick={onNavigate}
              badge={counts[c.key] ?? 0}
            />
          ))}
          {/* Annuaire & Chroniques vivent avec La Cour (vie sociale du royaume). */}
          {category === 'La Cour' && (
            <>
              <SideLink to="/armorial" icon="📜" ico="/icons/armorial.png?v=2" label="Annuaire" onClick={onNavigate} />
              <SideLink to="/chroniques" icon="📖" ico="/icons/chroniques.png?v=2" label="Chroniques" onClick={onNavigate} />
            </>
          )}
        </div>
      ))}

      <div className="side-cat">Alliance</div>
      <SideLink to="/alliances" icon="🤝" label="Alliances" onClick={onNavigate} />
      <SideLink to="/pactes" icon="🤝" ico="/icons/pactes.png?v=2" label="Pactes" onClick={onNavigate} />

      <div className="side-cat">Décisions</div>
      <SideLink to="/scrutins" icon="🗳️" ico="/icons/scrutins.png?v=2" label="Scrutins" onClick={onNavigate} />
      <SideLink to="/sort" icon="🪙" ico="/icons/sort.png?v=2" label="Le Sort" onClick={onNavigate} />

      <div className="side-cat">Toi</div>
      <SideLink to="/requetes" icon="🎫" ico="/icons/requetes.png?v=2" label="Requêtes" onClick={onNavigate} badge={tickets} />
      <SideLink to="/destin" icon="⚰️" ico="/icons/destin.png?v=2" label="Mon destin" onClick={onNavigate} />
      {(profile?.is_admin || profile?.is_observer) && (
        <SideLink to="/admin" icon="⚜️" ico="/icons/admin.png?v=2" label="La Citadelle" onClick={onNavigate} />
      )}
    </nav>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth()
  const h = getHouse(profile?.house)
  const [open, setOpen] = useState(false)

  return (
    <div className="app-shell">
      <div className="app-header">
      <Banner />
      <header className="topbar">
        <button className="burger" onClick={() => setOpen((o) => !o)} aria-label="Salons">
          ☰
        </button>
        <Wordmark compact />

        {profile && (
          <div className="me">
            <Link to="/destin" className="me-chip" title="Mon personnage">
              <Seal house={profile.house} />
              <span className="me-text">
                <span className="me-name">{profile.character_name}</span>
                <span className="me-house">Maison {h.nom}</span>
              </span>
            </Link>
            <span className="me-badges">
              {profile.is_king && <span className="badge king">👑 Roi</span>}
              {profile.is_founder ? (
                <span className="badge gm">Grand Mestre</span>
              ) : (
                profile.is_admin && <span className="badge">Mestre</span>
              )}
              {profile.is_observer && <span className="badge obs">Observateur</span>}
            </span>
            <button className="linkbtn" onClick={signOut}>
              Sortir
            </button>
          </div>
        )}
      </header>
      </div>

      <div className="app-body">
        {open && <div className="side-scrim" onClick={() => setOpen(false)} />}
        <aside className={`sidebar${open ? ' open' : ''}`}>
          <Sidebar onNavigate={() => setOpen(false)} />
        </aside>

        <main className="content">
          {children}

          <footer className="foot">
            <p className="winter">« {h.devise} »</p>
            <p>
              <Link to="/charte">Charte &amp; code de conduite</Link>
              {' · '}
              <Link to="/mentions">Mentions légales</Link>
              {' · '}
              <Link to="/confidentialite">Confidentialité (RGPD)</Link>
            </p>
            <p>Projet de fan, non affilié à Paradox Interactive, HBO ou George R. R. Martin.</p>
            <p style={{ color: 'var(--gold-dim)' }}>✒️ Créé par <b>Falcko</b></p>
          </footer>
        </main>
      </div>
    </div>
  )
}
