import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { UnreadProvider } from './context/UnreadContext'
import { Layout } from './components/Layout'
import { Gate } from './pages/Gate'
import { Onboarding } from './pages/Onboarding'
import { ChannelFeed } from './pages/ChannelFeed'
import { Charte, Mentions, Confidentialite, NotFound } from './pages/Static'

/* Routes lourdes ou rarement affichées au premier rendu : chargées à la demande
   pour alléger le bundle initial (la Porte et l'accueil restent immédiats). */
const Chancellerie = lazy(() => import('./pages/Chancellerie').then((m) => ({ default: m.Chancellerie })))
const Conversations = lazy(() => import('./pages/Conversations').then((m) => ({ default: m.Conversations })))
const Hrp = lazy(() => import('./pages/Hrp').then((m) => ({ default: m.Hrp })))
const Annuaire = lazy(() => import('./pages/Annuaire').then((m) => ({ default: m.Annuaire })))
const Personnage = lazy(() => import('./pages/Personnage').then((m) => ({ default: m.Personnage })))
const Requetes = lazy(() => import('./pages/Requetes').then((m) => ({ default: m.Requetes })))
const Chroniques = lazy(() => import('./pages/Chroniques').then((m) => ({ default: m.Chroniques })))
const Destin = lazy(() => import('./pages/Destin').then((m) => ({ default: m.Destin })))
const Scrutins = lazy(() => import('./pages/Scrutins').then((m) => ({ default: m.Scrutins })))
const Sort = lazy(() => import('./pages/Sort').then((m) => ({ default: m.Sort })))
const Carte = lazy(() => import('./pages/Carte').then((m) => ({ default: m.Carte })))
const Pactes = lazy(() => import('./pages/Pactes').then((m) => ({ default: m.Pactes })))
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })))

/* ============================================================================
   Aiguillage de l'application.
   - Non connecté : la Porte (Gate) + pages légales accessibles publiquement.
   - Connecté : la coquille (Layout) avec les rubriques.
   ========================================================================== */

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      {children}
    </div>
  )
}

export default function App() {
  const { session, profile, loading, configured } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <FullScreen>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 14px' }} />
          <p className="kicker">La Chancellerie s'éveille…</p>
        </div>
      </FullScreen>
    )
  }

  // ── Visiteur (non connecté ou base non configurée) ──
  if (!configured || !session || !profile) {
    return (
      <Routes>
        <Route path="/charte" element={<PublicPage page={<Charte />} />} />
        <Route path="/mentions" element={<PublicPage page={<Mentions />} />} />
        <Route path="/confidentialite" element={<PublicPage page={<Confidentialite />} />} />
        <Route path="*" element={<Gate />} />
      </Routes>
    )
  }

  // ── Connecté mais profil incomplet (1ʳᵉ connexion Discord) ──
  if (!profile.onboarded) {
    return <Onboarding />
  }

  // ── Mestre connecté ──
  return (
    <UnreadProvider>
      <Layout>
        <Suspense fallback={<div className="empty"><span className="spinner" /> Ouverture du grimoire…</div>}>
        {/* Clé par route : chaque page se pose avec une douce ouverture (DA Grimoire). */}
        <div key={location.pathname} className="page-enter">
        <Routes location={location}>
        <Route path="/" element={<Navigate to="/c/decret-royal" replace />} />
        <Route path="/chancellerie" element={<Chancellerie />} />
        <Route path="/conversations" element={<Conversations />} />
        <Route path="/hrp" element={<Hrp />} />
        <Route path="/c/:channelKey" element={<ChannelFeed />} />
        <Route path="/armorial" element={<Annuaire />} />
        <Route path="/joueurs" element={<Annuaire initial="cour" />} />
        <Route path="/personnage/:id" element={<Personnage />} />
        <Route path="/pactes" element={<Pactes />} />
        <Route path="/requetes" element={<Requetes />} />
        <Route path="/chroniques" element={<Chroniques />} />
        <Route path="/carte" element={<Carte />} />
        <Route path="/trone" element={<Navigate to="/carte" replace />} />
        <Route path="/scrutins" element={<Scrutins />} />
        <Route path="/sort" element={<Sort />} />
        <Route path="/destin" element={<Destin />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/charte" element={<Charte />} />
        <Route path="/mentions" element={<Mentions />} />
        <Route path="/confidentialite" element={<Confidentialite />} />
        <Route path="*" element={<NotFound />} />
        </Routes>
        </div>
        </Suspense>
      </Layout>
    </UnreadProvider>
  )
}

/** Pages légales hors connexion : un fil de retour minimal vers la Porte. */
function PublicPage({ page }: { page: React.ReactNode }) {
  return (
    <div className="wrap">
      <div style={{ marginBottom: 18 }}>
        <Link className="linkbtn" to="/">
          ← Retour à la Porte
        </Link>
      </div>
      {page}
    </div>
  )
}
