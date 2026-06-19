import { Link } from 'react-router-dom'

/* Pages statiques — charte, mentions légales, confidentialité (RGPD), 404.
   Textes de base à relire/adapter par la communauté. */

function Page({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="section-h">{titre}</h2>
      <div className="parchment reading">
        <div className="pm-body" style={{ fontSize: 17 }}>
          {children}
        </div>
      </div>
    </section>
  )
}

export function Charte() {
  return (
    <Page titre="Charte & code de conduite">
      <p>
        CK3FR RP est un espace de roleplay bienveillant. En y prêtant serment, tu acceptes ces
        quelques règles :
      </p>
      <ul style={{ lineHeight: 1.8 }}>
        <li>Respecte les autres joueurs hors-personnage : pas de harcèlement, d'insultes ni de haine.</li>
        <li>Distingue le personnage du joueur. Les conflits RP restent dans le RP.</li>
        <li>Aucun contenu illégal, haineux, ou à caractère sexuel impliquant des mineurs.</li>
        <li>Pas de spam ni de publicité hors-univers.</li>
        <li>Les Grands Mestres peuvent modérer, masquer ou retirer tout contenu, et bannir en cas d'abus.</li>
      </ul>
      <p>
        Un comportement contraire à cette charte peut entraîner un avertissement, la suppression de
        contenus, ou le bannissement. Pour signaler un abus, utilise le bouton de signalement présent
        sur les lettres, proclamations et commentaires.
      </p>
    </Page>
  )
}

export function Mentions() {
  return (
    <Page titre="Mentions légales">
      <p>
        <b>CK3FR RP</b> est un projet de fan à but non lucratif, dédié au roleplay autour du jeu
        <i> Crusader Kings III</i> dans l'univers <i>A Game of Thrones</i>.
      </p>
      <p>
        Ce site n'est affilié, soutenu ni approuvé par <b>Paradox Interactive</b>, <b>HBO</b>, ni par{' '}
        <b>George R. R. Martin</b>. Toutes les marques et œuvres citées appartiennent à leurs
        détenteurs respectifs.
      </p>
      <p>
        Éditeur du site : la communauté CK3FR RP. Hébergement : Vercel (frontend) et Supabase
        (données). Pour toute demande, contacte l'équipe d'administration.
      </p>
    </Page>
  )
}

export function Confidentialite() {
  return (
    <Page titre="Politique de confidentialité (RGPD)">
      <p>Nous limitons les données collectées au strict nécessaire au fonctionnement du jeu :</p>
      <ul style={{ lineHeight: 1.8 }}>
        <li>Ton adresse e-mail (authentification et confirmation de compte).</li>
        <li>Ton identifiant, ton personnage et ta maison.</li>
        <li>Les lettres, proclamations, commentaires et images que tu publies.</li>
      </ul>
      <p>
        Ces données sont stockées chez Supabase et ne sont ni revendues, ni transmises à des tiers à
        des fins commerciales.
      </p>
      <p>
        <b>Droit à l'effacement :</b> tu peux à tout moment demander la suppression de ton compte et de
        tes données depuis la page <Link to="/destin">Mon destin</Link>, ou en contactant un Grand
        Mestre. La suppression libère également ta maison.
      </p>
    </Page>
  )
}

export function NotFound() {
  return (
    <section>
      <h2 className="section-h">Pli égaré</h2>
      <div className="empty">
        Ce pli n'a trouvé aucune adresse où se poser.
        <br />
        <Link to="/chancellerie">↩ Retour à la Chancellerie</Link>
      </div>
    </section>
  )
}
