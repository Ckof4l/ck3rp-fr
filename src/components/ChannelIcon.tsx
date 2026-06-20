import { Seal } from './Seal'
import type { Channel } from '../lib/channels'

/* Icône d'un salon : le blason de la maison régnante pour une région,
   sinon l'emoji du salon. */

export function ChannelIcon({ channel, size = 'sm' }: { channel?: Channel; size?: 'sm' | 'md' }) {
  if (channel?.ruler) return <Seal house={channel.ruler} size={size} />
  if (channel?.key) {
    return (
      <img
        className={size === 'md' ? 'ch-ico md' : 'ch-ico'}
        src={`/icons/${channel.key}.png?v=2`}
        alt=""
        onError={(e) => {
          // Repli sur l'emoji si l'icône n'existe pas encore.
          e.currentTarget.outerHTML = `<span class="ch-emoji">${channel.icon ?? '📜'}</span>`
        }}
      />
    )
  }
  return <span className="ch-emoji">{channel?.icon ?? '📜'}</span>
}
