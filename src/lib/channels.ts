import type { Profile } from '../types/database'
import { getHouse } from './houses'

/* ============================================================================
   Salons du RP — calqués sur le Discord « Les 7 Royaumes ».
   Les clés (`key`) sont stockées dans posts.channel ; tout le reste vit ici.
   ========================================================================== */

export type ChannelKind = 'decree' | 'region' | 'talk' | 'lore'

export interface Channel {
  key: string
  name: string
  category: string
  icon: string
  description: string
  kind: ChannelKind
  /** Pour les salons régionaux : nom de région (= House.region) qui peut y écrire. */
  region?: string
  /** Pour les salons régionaux : clé de la maison régnante (blason affiché dans la barre). */
  ruler?: string
}

export const CHANNELS: Channel[] = [
  // ── Décrets ──
  { key: 'decret-royal', name: 'Décret royal', category: 'Décrets', icon: '👑', kind: 'decree',
    description: "Proclamations des Rois des Sept Royaumes. Seuls les Rois y décrètent ; chacun peut commenter." },
  { key: 'decret-noble', name: 'Décret noble', category: 'Décrets', icon: '📜', kind: 'decree',
    description: "Édits et annonces des seigneurs vassaux. Réservé aux vassaux ; chacun peut commenter." },

  // ── Le Royaume (une région par salon) ──
  { key: 'le-nord',           name: 'Le Nord',            category: 'Le Royaume', icon: '❄️', kind: 'region', region: 'Le Nord',               ruler: 'stark',     description: "Le RP du Nord, de Winterfell au Mur." },
  { key: 'le-val',            name: 'La Montagne et le Val', category: 'Le Royaume', icon: '🦅', kind: 'region', region: 'La Montagne et le Val', ruler: 'arryn',     description: "Le RP du Val d'Arryn et des Montagnes de la Lune." },
  { key: 'le-roc',            name: "Les Terres de l'Ouest", category: 'Le Royaume', icon: '🦁', kind: 'region', region: 'Le Roc',               ruler: 'lannister', description: "Le RP du Roc de Castral et de l'Ouest." },
  { key: 'le-trident',        name: 'Le Trident',         category: 'Le Royaume', icon: '🐟', kind: 'region', region: 'Le Trident',            ruler: 'durrandon', description: "Le RP du Conflans et des Terres des Rivières." },
  { key: 'le-bief',           name: 'Le Bief',            category: 'Le Royaume', icon: '🌾', kind: 'region', region: 'Le Bief',               ruler: 'jardinier', description: "Le RP du Bief et de Hautjardin." },
  { key: 'dorne',             name: 'Dorne',              category: 'Le Royaume', icon: '☀️', kind: 'region', region: 'Dorne',                 ruler: 'martell',   description: "Le RP de Dorne, des sables aux montagnes Rouges." },
  { key: 'les-iles-de-fer',   name: 'Les Îles de Fer',    category: 'Le Royaume', icon: '🐙', kind: 'region', region: 'Les Îles de Fer',       ruler: 'greyjoy',   description: "Le RP des Îles de Fer et de leurs reavers." },
  { key: 'peyredragon',       name: 'Peyredragon',        category: 'Le Royaume', icon: '🐉', kind: 'region', region: 'Peyredragon',           ruler: 'targaryen', description: "Le RP de Peyredragon et des seigneurs du détroit." },

  // ── La Cour ──
  { key: 'rumeurs', name: 'Rumeurs', category: 'La Cour', icon: '🗣️', kind: 'talk',
    description: "Bruits de couloir, ragots et secrets murmurés. Ouvert à tous." },
  { key: 'lore',    name: 'Lore',    category: 'La Cour', icon: '📖', kind: 'lore',
    description: "L'encyclopédie du monde : histoire, maisons, géographie. Tenu par les Grands Mestres." },
]

/** Ordre d'affichage des catégories dans la barre latérale. */
export const CATEGORY_ORDER = ['Décrets', 'La Cour', 'Le Royaume']

const BY_KEY: Record<string, Channel> = Object.fromEntries(CHANNELS.map((c) => [c.key, c]))

export function getChannel(key: string | undefined): Channel | undefined {
  return key ? BY_KEY[key] : undefined
}

export function channelsByCategory(): { category: string; channels: Channel[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    channels: CHANNELS.filter((c) => c.category === category),
  }))
}

/**
 * Droit de publier dans un salon (miroir client de `can_post_channel` côté SQL ;
 * la RLS reste la véritable barrière).
 */
/** Le joueur est-il actuellement réduit au silence ? */
export function isMuted(profile: Profile | null): boolean {
  return !!profile?.muted_until && new Date(profile.muted_until) > new Date()
}

export function canPostChannel(profile: Profile | null, key: string): boolean {
  if (!profile || profile.is_observer || isMuted(profile)) return false
  if (key === 'decret-royal') return !!profile.is_king || !!profile.is_admin
  if (key === 'decret-noble') return !profile.is_king
  if (key === 'lore') return !!profile.is_admin
  if (key === 'rumeurs') return true
  const ch = BY_KEY[key]
  if (ch?.kind === 'region') {
    // On ne publie que dans la région de sa maison.
    return getHouse(profile.house).region === ch.region
  }
  return true
}

/** Peut commenter : tout joueur connecté non-observateur et non réduit au silence. */
export function canComment(profile: Profile | null): boolean {
  return !!profile && !profile.is_observer && !isMuted(profile)
}
