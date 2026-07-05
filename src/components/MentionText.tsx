import type { Profile } from '../types/database'
import { splitMentions } from '../lib/mentions'
import { CharLink } from './CharLink'

/* ============================================================================
   Texte avec mentions — rend un corps de lettre/commentaire en surlignant
   chaque « @Nom De Personnage » reconnu (lien vers la fiche du joueur).
   ========================================================================== */

export function MentionText({ text, players }: { text: string; players: Profile[] }) {
  if (!text.includes('@') || !players.length) return <>{text}</>
  return (
    <>
      {splitMentions(text, players).map((part, i) =>
        typeof part === 'string' ? (
          part
        ) : (
          <CharLink key={i} id={part.player.id} className="mention">
            @{part.player.character_name}
          </CharLink>
        ),
      )}
    </>
  )
}
