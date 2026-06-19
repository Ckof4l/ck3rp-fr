import { Seal } from './Seal'
import type { Channel } from '../lib/channels'

/* Icône d'un salon : le blason de la maison régnante pour une région,
   sinon l'emoji du salon. */

export function ChannelIcon({ channel, size = 'sm' }: { channel?: Channel; size?: 'sm' | 'md' }) {
  if (channel?.ruler) return <Seal house={channel.ruler} size={size} />
  return <span className="ch-emoji">{channel?.icon ?? '📜'}</span>
}
