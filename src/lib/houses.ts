/* ============================================================================
   Référentiel des maisons des Sept Royaumes (ère de la Conquête)
   Défini côté front (comme prévu par le cahier des charges). La base de données
   ne stocke qu'une clé de maison (`house_key`) ; nom, région, emblème, couleur,
   personnage canonique et devise vivent ici.
   ========================================================================== */

export interface House {
  /** Clé stable utilisée en base (house_key / profiles.house). */
  key: string
  nom: string
  region: string
  /** Emblème (emoji conservé depuis l'artefact d'origine). */
  sig: string
  /** Couleur du sceau de cire. */
  col: string
  /** Personnage canonique proposé par défaut à l'inscription. */
  canon: string
  /** Devise de la maison (façon « mots » dans GoT). */
  devise: string
}

export const HOUSES: Record<string, House> = {
  // ── Le Nord ──
  stark:     { key: 'stark',     nom: 'Stark',           region: 'Le Nord',                sig: '🐺', col: '#8A95A3', canon: 'Lord Brandon Stark',         devise: "L'hiver vient." },
  forestier: { key: 'forestier', nom: 'Forestier',       region: 'Le Nord',                sig: '🌲', col: '#4A6B4A', canon: 'Lord Robin Forester',        devise: "Le fer naît de la glace." },
  manderly:  { key: 'manderly',  nom: 'Manderly',        region: 'Le Nord',                sig: '🧜', col: '#2E7E7E', canon: 'Lord Torrhen Manderly',      devise: "Toujours fidèles." },
  reed:      { key: 'reed',      nom: 'Reed',            region: 'Le Nord',                sig: '🦎', col: '#5E7A4E', canon: 'Lord Leon Reed',             devise: "Sous le roseau, la patience." },
  karstark:  { key: 'karstark',  nom: 'Karstark',        region: 'Le Nord',                sig: '✴️', col: '#AEB9C4', canon: 'Lord Alton Karstark',        devise: "Le soleil blanc de l'hiver." },
  // ── Le Trident ──
  durrandon: { key: 'durrandon', nom: 'Durrandon',       region: 'Le Trident',             sig: '🦌', col: '#C9A24B', canon: 'Roi Arrec Durrandon',        devise: "Nôtre est la furie." },
  connington:{ key: 'connington',nom: 'Connington',      region: 'Le Trident',             sig: '🦅', col: '#B23A33', canon: 'Lord Jon Connington',        devise: "Le griffon veille." },
  frey:      { key: 'frey',      nom: 'Frey',            region: 'Le Trident',             sig: '🏰', col: '#6E7681', canon: 'Lord Oswald Frey',           devise: "Nous nous tenons ensemble." },
  bracken:   { key: 'bracken',   nom: 'Bracken',         region: 'Le Trident',             sig: '🐎', col: '#9A5A33', canon: 'Lord Lothar Bracken',        devise: "Fiers et indomptés." },
  tully:     { key: 'tully',     nom: 'Tully',           region: 'Le Trident',             sig: '🐟', col: '#3A5A8A', canon: 'Lord Tommen Tully',          devise: "Famille, Devoir, Honneur." },
  // ── Le Roc ──
  lannister: { key: 'lannister', nom: 'Lannister',       region: 'Le Roc',                 sig: '🦁', col: '#C9A24B', canon: 'Roi Tommen Lannister',       devise: "Un Lannister paie toujours ses dettes." },
  brax:      { key: 'brax',      nom: 'Brax',            region: 'Le Roc',                 sig: '🦄', col: '#8A6FB0', canon: 'Lord Andros Brax',           devise: "La corne haute et fière." },
  reyne:     { key: 'reyne',     nom: 'Reyne',           region: 'Le Roc',                 sig: '🦁', col: '#9A2F2A', canon: 'Lord Gerion Reyne',          devise: "Le lion rouge ne s'incline pas." },
  lefford:   { key: 'lefford',   nom: 'Lefford',         region: 'Le Roc',                 sig: '⛰️', col: '#B89A4A', canon: 'Lady Sylvina Lefford',       devise: "De la montagne coule l'or." },
  // ── La Montagne et le Val ──
  arryn:     { key: 'arryn',     nom: 'Arryn',           region: 'La Montagne et le Val',  sig: '🦅', col: '#5A7FA8', canon: 'Lord Ronnel Arryn',          devise: "Aussi haut que l'honneur." },
  grafton:   { key: 'grafton',   nom: 'Grafton',         region: 'La Montagne et le Val',  sig: '🔥', col: '#C2622A', canon: 'Lady Corrine Grafton',       devise: "La flamme de Goëville." },
  melcolm:   { key: 'melcolm',   nom: 'Melcolm',         region: 'La Montagne et le Val',  sig: '🛡️', col: '#6E6A86', canon: 'Lord Gunthor Melcolm',       devise: "Le bouclier du Val." },
  hersy:     { key: 'hersy',     nom: 'Hersy',           region: 'La Montagne et le Val',  sig: '⚜️', col: '#7A6A4A', canon: 'Lord Jaime Hersy',           devise: "Sans peur et sans tache." },
  // ── Le Bief ──
  jardinier: { key: 'jardinier', nom: 'Jardinier',       region: 'Le Bief',                sig: '🖐️', col: '#3F8A4E', canon: 'Roi Garland Jardinier',      devise: "Le Bief fleurit sous notre main." },
  hightower: { key: 'hightower', nom: 'Hightower',       region: 'Le Bief',                sig: '🗼', col: '#B0A98F', canon: 'Lord Barth Hightower',       devise: "Nous éclairons la voie." },
  redwyne:   { key: 'redwyne',   nom: 'Redwyne',         region: 'Le Bief',                sig: '🍇', col: '#7A3A55', canon: 'Lord Aladore Redwyne',       devise: "Nos vignes, notre force." },
  rowan:     { key: 'rowan',     nom: 'Rowan',           region: 'Le Bief',                sig: '🌳', col: '#C2A24B', canon: 'Lord Colin Rowan',           devise: "Sous l'arbre d'or, l'abondance." },
  // ── Dorne ──
  martell:   { key: 'martell',   nom: 'Nymeros Martell', region: 'Dorne',                  sig: '☀️', col: '#D08A2A', canon: 'Princesse Jinny Nymeros Martell', devise: "Insoumis, Invaincus, Intacts." },
  dayne:     { key: 'dayne',     nom: 'Dayne',           region: 'Dorne',                  sig: '🌠', col: '#7A6FB0', canon: 'Lord Franklyn Dayne',        devise: "De l'épée et de l'étoile." },
  noirmont:  { key: 'noirmont',  nom: 'Noirmont',        region: 'Dorne',                  sig: '🦅', col: '#3A3340', canon: 'Lady Giselle Noirmont',      devise: "Patient comme le vautour." },
  ferboy:    { key: 'ferboy',    nom: 'Ferboy',          region: 'Dorne',                  sig: '🦂', col: '#B08A4A', canon: 'Lord Yormwell Ferboy',       devise: "Le dard guette dans le sable." },
  // ── Les Îles de Fer ──
  chenu:     { key: 'chenu',     nom: 'Chenu',           region: 'Les Îles de Fer',        sig: '⚔️', col: '#6E6A66', canon: 'Lord Qhorwyn Chenu',         devise: "Le sel et le fer." },
  greyjoy:   { key: 'greyjoy',   nom: 'Greyjoy',         region: 'Les Îles de Fer',        sig: '🐙', col: '#2E4A4A', canon: 'Lord Urron Greyjoy',         devise: "Nous ne semons pas." },
  harloi:    { key: 'harloi',    nom: 'Harloi',          region: 'Les Îles de Fer',        sig: '🌾', col: '#8A8A7A', canon: 'Lord Drennan Harloi',        devise: "Le glas sonne pour l'ennemi." },
  // ── Peyredragon ──
  targaryen: { key: 'targaryen', nom: 'Targaryen',       region: 'Peyredragon',            sig: '🐉', col: '#8E2F2A', canon: 'Aenar « L\'Exilé » Targaryen', devise: "Feu et Sang." },
  velaryon:  { key: 'velaryon',  nom: 'Velaryon',        region: 'Peyredragon',            sig: '🌊', col: '#4A8A8A', canon: 'Lord Vaemond Velaryon',      devise: "Le Vieux, le Vrai, le Brave." },
  celtigar:  { key: 'celtigar',  nom: 'Celtigar',        region: 'Peyredragon',            sig: '🦀', col: '#A23A33', canon: 'Lord Adrian Celtigar',       devise: "La pince ne lâche jamais." },
  // ── Maisons additionnelles (tout l'univers — blasons rendus depuis le mod AGOT) ──
  bolton:     { key: 'bolton', nom: 'Bolton', region: 'Le Nord', sig: '🛡️', col: '#8C1825', canon: '', devise: "Nos lames sont aiguisées." },
  umber:      { key: 'umber', nom: 'Omble', region: 'Le Nord', sig: '🛡️', col: '#A4302A', canon: '', devise: "Ici nous tenons." },
  mormont:    { key: 'mormont', nom: 'Mormont', region: 'Le Nord', sig: '🛡️', col: '#1C851C', canon: '', devise: "Ici nous tenons." },
  glover:     { key: 'glover', nom: 'Glover', region: 'Le Nord', sig: '🛡️', col: '#9A4030', canon: '', devise: "Notre main protège." },
  hornwood:   { key: 'hornwood', nom: 'Corbois', region: 'Le Nord', sig: '🛡️', col: '#A35021', canon: '', devise: "Droits comme la lance." },
  cerwyn:     { key: 'cerwyn', nom: 'Cerwyn', region: 'Le Nord', sig: '🛡️', col: '#8C969C', canon: '', devise: "Hachés mais debout." },
  tallhart:   { key: 'tallhart', nom: 'Tallhart', region: 'Le Nord', sig: '🛡️', col: '#673620', canon: '', devise: "Fiers et grands." },
  dustin:     { key: 'dustin', nom: 'Dustin', region: 'Le Nord', sig: '🛡️', col: '#C08A1E', canon: '', devise: "Les barons se souviennent." },
  blackwood:  { key: 'blackwood', nom: 'Blackwood', region: 'Le Trident', sig: '🛡️', col: '#940503', canon: '', devise: "Le corbeau n'oublie pas." },
  mallister:  { key: 'mallister', nom: 'Mallister', region: 'Le Trident', sig: '🛡️', col: '#23308A', canon: '', devise: "Au-dessus du reste." },
  vance:      { key: 'vance', nom: 'Vance', region: 'Le Trident', sig: '🛡️', col: '#3A3A3A', canon: '', devise: "Garde contre la nuit." },
  piper:      { key: 'piper', nom: 'Piper', region: 'Le Trident', sig: '🛡️', col: '#1E4E96', canon: '', devise: "Brave et docile." },
  darry:      { key: 'darry', nom: 'Darry', region: 'Le Trident', sig: '🛡️', col: '#673620', canon: '', devise: "Le laboureur reste." },
  mooton:     { key: 'mooton', nom: 'Mooton', region: 'Le Trident', sig: '🛡️', col: '#A4302A', canon: '', devise: "Rouge comme l'aurore." },
  whent:      { key: 'whent', nom: 'Whent', region: 'Le Trident', sig: '🛡️', col: '#C08A1E', canon: '', devise: "Noires chauves-souris d'Harrenhal." },
  clegane:    { key: 'clegane', nom: 'Clegane', region: 'Le Roc', sig: '🛡️', col: '#C08A1E', canon: '', devise: "Les chiens mordent." },
  marbrand:   { key: 'marbrand', nom: 'Marpheux', region: 'Le Roc', sig: '🛡️', col: '#5C4E4E', canon: '', devise: "Brûlants et fiers." },
  crakehall:  { key: 'crakehall', nom: 'Crakehall', region: 'Le Roc', sig: '🛡️', col: '#673620', canon: '', devise: "Aucun sanglier ne recule." },
  westerling: { key: 'westerling', nom: 'Westerling', region: 'Le Roc', sig: '🛡️', col: '#BAA977', canon: '', devise: "Honneur, pas honneurs." },
  payne:      { key: 'payne', nom: 'Payne', region: 'Le Roc', sig: '🛡️', col: '#6B3B55', canon: '', devise: "Silencieux et loyaux." },
  swyft:      { key: 'swyft', nom: 'Swyft', region: 'Le Roc', sig: '🛡️', col: '#C08A1E', canon: '', devise: "Vif et rusé." },
  royce:      { key: 'royce', nom: 'Royce', region: 'La Montagne et le Val', sig: '🛡️', col: '#A65F2D', canon: '', devise: "Nous nous souvenons." },
  corbray:    { key: 'corbray', nom: 'Corbray', region: 'La Montagne et le Val', sig: '🛡️', col: '#B0413E', canon: '', devise: "Dame Désespoir veille." },
  waynwood:   { key: 'waynwood', nom: 'Waynwood', region: 'La Montagne et le Val', sig: '🛡️', col: '#0A6616', canon: '', devise: "La roue tourne." },
  hunter:     { key: 'hunter', nom: 'Hunter', region: 'La Montagne et le Val', sig: '🛡️', col: '#673620', canon: '', devise: "La meute ne faiblit pas." },
  redfort:    { key: 'redfort', nom: 'Fort-Rouge', region: 'La Montagne et le Val', sig: '🛡️', col: '#940503', canon: '', devise: "Solide comme la pierre." },
  belmore:    { key: 'belmore', nom: 'Belmore', region: 'La Montagne et le Val', sig: '🛡️', col: '#4E0A69', canon: '', devise: "Les cloches sonnent vrai." },
  tyrell:     { key: 'tyrell', nom: 'Tyrell', region: 'Le Bief', sig: '🛡️', col: '#0A6616', canon: '', devise: "Plus fort en grandissant." },
  tarly:      { key: 'tarly', nom: 'Tarly', region: 'Le Bief', sig: '🛡️', col: '#0A6616', canon: '', devise: "Premiers au combat." },
  florent:    { key: 'florent', nom: 'Florent', region: 'Le Bief', sig: '🛡️', col: '#9C6B2E', canon: '', devise: "Le renard veille." },
  oakheart:   { key: 'oakheart', nom: 'Cœur-de-Chêne', region: 'Le Bief', sig: '🛡️', col: '#D7B45A', canon: '', devise: "Fidèle et fort." },
  fossoway:   { key: 'fossoway', nom: 'Fossoway', region: 'Le Bief', sig: '🛡️', col: '#A4302A', canon: '', devise: "Mûr et savoureux." },
  caswell:    { key: 'caswell', nom: 'Caswell', region: 'Le Bief', sig: '🛡️', col: '#C08A1E', canon: '', devise: "La porte du Bief." },
  yronwood:   { key: 'yronwood', nom: 'Yronwood', region: 'Dorne', sig: '🛡️', col: '#BAA977', canon: '', devise: "Nous gardons la voie." },
  fowler:     { key: 'fowler', nom: 'Fowler', region: 'Dorne', sig: '🛡️', col: '#5A7FA8', canon: '', devise: "Laissez-les voler." },
  allyrion:   { key: 'allyrion', nom: 'Allyrion', region: 'Dorne', sig: '🛡️', col: '#760302', canon: '', devise: "Aucune épine ne nous arrête." },
  jordayne:   { key: 'jordayne', nom: 'Jordayne', region: 'Dorne', sig: '🛡️', col: '#22A123', canon: '', devise: "L'esprit avant la lame." },
  santagar:   { key: 'santagar', nom: 'Santagar', region: 'Dorne', sig: '🛡️', col: '#032D72', canon: '', devise: "Le tacheté frappe." },
  manwoody:   { key: 'manwoody', nom: 'Manwoody', region: 'Dorne', sig: '🛡️', col: '#2A2828', canon: '', devise: "La mort vient des sables." },
  uller:      { key: 'uller', nom: 'Uller', region: 'Dorne', sig: '🛡️', col: '#C08A1E', canon: '', devise: "Brûlante est la vengeance." },
  botley:     { key: 'botley', nom: 'Botley', region: 'Les Îles de Fer', sig: '🛡️', col: '#929CA2', canon: '', devise: "Sous les flots, la richesse." },
  goodbrother:{ key: 'goodbrother', nom: 'Bonfrère', region: 'Les Îles de Fer', sig: '🛡️', col: '#940503', canon: '', devise: "Le cor de guerre résonne." },
  drumm:      { key: 'drumm', nom: 'Tambur', region: 'Les Îles de Fer', sig: '🛡️', col: '#A4302A', canon: '', devise: "Le tambour de la bataille." },
  blacktyde:  { key: 'blacktyde', nom: 'Néguemarée', region: 'Les Îles de Fer', sig: '🛡️', col: '#0A6616', canon: '', devise: "Noire est la marée." },
  wynch:      { key: 'wynch', nom: 'Wynch', region: 'Les Îles de Fer', sig: '🛡️', col: '#4E0A69', canon: '', devise: "Le fer ne plie pas." },
  sunglass:   { key: 'sunglass', nom: 'Sunglass', region: 'Peyredragon', sig: '🛡️', col: '#B7C5CB', canon: '', devise: "La lumière des Sept." },
  massey:     { key: 'massey', nom: 'Massey', region: 'Peyredragon', sig: '🛡️', col: '#9AA6AC', canon: '', devise: "Gardiens du détroit." },
  rosby:      { key: 'rosby', nom: 'Rosby', region: 'Peyredragon', sig: '🛡️', col: '#B23A33', canon: '', devise: "Le blé et le bois." },
  stokeworth: { key: 'stokeworth', nom: 'Stokeworth', region: 'Peyredragon', sig: '🛡️', col: '#0A6616', canon: '', devise: "Fiers et prospères." },
  darklyn:    { key: 'darklyn', nom: 'Darklyn', region: 'Peyredragon', sig: '🛡️', col: '#6E7681', canon: '', devise: "Sombreval ne plie pas." },

  // ── Échappatoire ──
  autre:     { key: 'autre',     nom: 'Autre / libre',   region: 'Sans allégeance',        sig: '🕯️', col: '#6B5E4A', canon: '',                           devise: "Libre de toute allégeance." },
}

/** La maison « autre » est ouverte à tous : jamais verrouillée par une revendication. */
export const FREE_HOUSE_KEY = 'autre'

/** Récupère une maison par sa clé, avec repli sûr sur « autre ». */
export function getHouse(key: string | null | undefined): House {
  return (key && HOUSES[key]) || HOUSES[FREE_HOUSE_KEY]
}

/** Liste des maisons groupées par région, dans l'ordre de déclaration. */
export function housesByRegion(): { region: string; houses: House[] }[] {
  const order: string[] = []
  const map: Record<string, House[]> = {}
  for (const h of Object.values(HOUSES)) {
    if (!map[h.region]) {
      map[h.region] = []
      order.push(h.region)
    }
    map[h.region].push(h)
  }
  return order.map((region) => ({ region, houses: map[region] }))
}

/** Éclaircit / assombrit une couleur hex (pour les dégradés de sceau). */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  let r = (n >> 16) + amt
  let g = ((n >> 8) & 255) + amt
  let b = (n & 255) + amt
  r = Math.max(0, Math.min(255, r))
  g = Math.max(0, Math.min(255, g))
  b = Math.max(0, Math.min(255, b))
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}
