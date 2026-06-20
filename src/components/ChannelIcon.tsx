import { Seal } from './Seal'
import type { Channel } from '../lib/channels'

/* Icône d'un salon : le blason de la maison régnante pour une région,
   sinon l'emoji du salon. */

export function ChannelIcon({ channel, size = 'sm' }: { channel?: Channel; size?: 'sm' | 'md' }) {
  if (channel?.ruler) return <Seal house={channel.ruler} size={size} />
  if (channel?.key) {
    return (
      <span className={size === 'md' ? 'seal' : 'seal sm'}>
        <img
          className="seal-img"
          src={`/icons/${channel.key}.png?v=1`}
          alt=""
          onError={(e) => {
            // Repli sur l'emoji si l'icône n'existe pas encore.
            const span = e.currentTarget.parentElement
            if (span) span.outerHTML = `<span class="ch-emoji">${channel.icon ?? '📜'}</span>`
          }}
        />
      </span>
    )
  }
  return <span className="ch-emoji">{channel?.icon ?? '📜'}</span>
}
