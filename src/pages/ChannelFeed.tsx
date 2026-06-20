import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useUnread } from '../context/UnreadContext'
import { getChannel, canPostChannel, canComment, isMuted } from '../lib/channels'
import { getHouse, regionColor } from '../lib/houses'
import { fmtDate } from '../lib/format'
import { publicImageUrl, supabase } from '../lib/supabase'
import {
  listPosts,
  createPost,
  updatePost,
  setPinned,
  deletePost,
  listComments,
  addComment,
  updateComment,
  deleteComment,
  type PostRow,
  type CommentRow,
} from '../lib/posts'
import { Seal } from '../components/Seal'
import { Lettrine } from '../components/Lettrine'
import { ReportButton } from '../components/ReportButton'
import { HelpCard } from '../components/HelpCard'
import { ChannelIcon } from '../components/ChannelIcon'

/* ============================================================================
   Page d'un salon — fil de posts + composer (selon le rôle) + commentaires.
   ========================================================================== */

export function ChannelFeed() {
  const { channelKey } = useParams<{ channelKey: string }>()
  const channel = getChannel(channelKey)
  const { profile } = useAuth()
  const { markSeen } = useUnread()
  const meId = profile!.id

  const [posts, setPosts] = useState<PostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [openPost, setOpenPost] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!channel) return
    setLoading(true)
    setPosts(await listPosts(channel.key))
    setLoading(false)
  }, [channel])

  useEffect(() => {
    setOpenPost(null)
    refresh()
    if (channel) markSeen(channel.key)
  }, [refresh, channel, markSeen])

  // Fond propre à la région : la colonne de contenu prend la scène du royaume.
  useEffect(() => {
    const el = document.documentElement
    if (channel?.kind === 'region') {
      el.style.setProperty('--region-bg', `url(/bg/regions/${channel.key}.jpg)`)
      el.setAttribute('data-region', '')
    }
    return () => {
      el.style.removeProperty('--region-bg')
      el.removeAttribute('data-region')
    }
  }, [channel])

  // Stable pour ne pas re-souscrire les abonnements temps réel de PostDetail.
  const handleDeleted = useCallback(async () => {
    setOpenPost(null)
    await refresh()
  }, [refresh])

  // Temps réel : toute écriture dans ce salon (nouveau post, édition,
  // épinglage, suppression) recharge le fil. On ne marque « vu » que sur un
  // nouveau post — inutile sur une simple édition.
  useEffect(() => {
    if (!channel) return
    const ch = supabase
      .channel(`posts:${channel.key}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts', filter: `channel=eq.${channel.key}` },
        (payload) => {
          refresh()
          if (payload.eventType === 'INSERT') markSeen(channel.key)
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [channel, refresh, markSeen])

  if (!channel) {
    return (
      <section>
        <h2 className="section-h">Salon introuvable</h2>
        <div className="empty">Ce salon n'existe pas.</div>
      </section>
    )
  }

  const mayPost = canPostChannel(profile, channel.key)
  const useTitle = channel.kind === 'decree' || channel.kind === 'lore'

  if (openPost) {
    return (
      <PostDetail
        postId={openPost}
        meId={meId}
        isAdmin={!!profile?.is_admin}
        mayComment={canComment(profile)}
        onBack={() => setOpenPost(null)}
        onDeleted={handleDeleted}
      />
    )
  }

  return (
    <section>
      <h2 className="section-h">
        <ChannelIcon channel={channel} /> {channel.name}
      </h2>
      <p className="channel-desc">{channel.description}</p>

      {isMuted(profile) && profile?.muted_until && (
        <div className="err">
          🔇 Tu es réduit au silence jusqu'au {new Date(profile.muted_until).toLocaleString('fr-FR')}. Tu peux lire, mais pas publier ni commenter.
        </div>
      )}

      <HelpCard id="salons" title="Les salons — comment ça marche ?">
        Les salons sont les espaces de RP <b>public</b>, à la manière d'un Discord.
        <ul>
          <li>Tu <b>lis tout</b>, mais tu n'écris que là où tu as ta place : <b>ta région</b> (celle de ta maison), <b>Rumeurs</b> (ouvert à tous), et le décret de ton rang.</li>
          <li><b>👑 Décret royal</b> = les Rois · <b>📜 Décret noble</b> = les vassaux · <b>📖 Lore</b> = les Grands Mestres.</li>
          <li>Clique un post pour le lire et le <b>commenter</b>. Tu peux <b>✏️ éditer</b> et <b>📌 épingler</b> tes posts (ou ⚑ signaler ceux des autres).</li>
          <li>Un cadenas 🔒 = salon où tu peux lire mais pas publier.</li>
        </ul>
      </HelpCard>

      {mayPost ? (
        <Composer meId={meId} channelKey={channel.key} useTitle={useTitle} allowPrivate={channel.kind === 'region'} onPosted={refresh} />
      ) : (
        <div className="card" style={{ marginBottom: 18, color: '#9C8F71', fontSize: 14 }}>
          🔒 {lockReason(channel.key)} Tu peux lire et commenter.
        </div>
      )}

      {loading ? (
        <div className="empty">Ouverture du registre…</div>
      ) : !posts.length ? (
        <div className="empty">Rien n'a encore été écrit ici. Sois le premier.</div>
      ) : (
        <div className="feed">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onOpen={() => setOpenPost(p.id)} />
          ))}
        </div>
      )}
    </section>
  )
}

function lockReason(key: string): string {
  if (key === 'decret-royal') return 'Seuls les Rois peuvent décréter ici.'
  if (key === 'decret-noble') return 'Réservé aux seigneurs vassaux.'
  if (key === 'lore') return 'Seuls les Grands Mestres tiennent le Lore.'
  const ch = getChannel(key)
  if (ch?.kind === 'region') return `Réservé aux maisons de ${ch.region}.`
  return 'Publication restreinte.'
}

/* ── Carte d'un post (aperçu) ──────────────────────────────────────────── */

function PostCard({ post, onOpen }: { post: PostRow; onOpen: () => void }) {
  const h = getHouse(post.author?.house)
  const col = regionColor(h.region)
  return (
    <button
      className="post-card"
      onClick={onOpen}
      style={{ background: `linear-gradient(${col}33, ${col}5C), #1C150E`, borderColor: `${col}99` }}
    >
      <Seal house={post.author?.house} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="post-meta">
          {post.pinned && <span className="pin-tag">📌 Épinglé</span>}
          {post.is_hrp && <span className="pin-tag" style={{ background: '#2a2f3a', color: '#9DB4D0' }}>HRP</span>}
          {post.is_private && <span className="pin-tag" style={{ background: '#3a2a2a', color: '#E0B0B0' }}>🔒 Privé</span>}
          <span className="post-author">{post.author?.character_name ?? 'Inconnu'}</span>
          <span className="post-house">Maison {h.nom}</span>
          <span className="post-date">{fmtDate(post.created_at)}</span>
        </div>
        {post.title && <div className="post-title">{post.title}</div>}
        <div className="post-preview">
          {post.image_path ? '📎 ' : ''}
          {post.body.slice(0, 160) || (post.image_path ? '(image)' : '')}
        </div>
        <div className="post-foot">💬 {post.commentCount} · Ouvrir ›</div>
      </div>
    </button>
  )
}

/* ── Composer un post ──────────────────────────────────────────────────── */

function Composer({
  meId,
  channelKey,
  useTitle,
  allowPrivate,
  onPosted,
}: {
  meId: string
  channelKey: string
  useTitle: boolean
  allowPrivate: boolean
  onPosted: () => void
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isPrivate, setIsPrivate] = useState(false)
  const [isHrp, setIsHrp] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) return setStatus("Ce fichier n'est pas une image.")
    setImageFile(f)
    setImageUrl(URL.createObjectURL(f))
    setStatus('')
  }

  async function submit() {
    if (!body.trim() && !imageFile) return setStatus('Écris quelque chose ou joins une image.')
    setBusy(true)
    setStatus('Publication…')
    try {
      await createPost({ meId, channel: channelKey, title, body: body.trim(), imageFile, isPrivate, isHrp })
      setTitle('')
      setBody('')
      setImageFile(null)
      setImageUrl(null)
      setIsPrivate(false)
      setIsHrp(false)
      setStatus('')
      onPosted()
    } catch (e) {
      console.error('Publication échouée :', e)
      setStatus(e instanceof Error ? e.message : 'La publication a échoué.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="composer">
      {useTitle && (
        <input
          className="input"
          style={{ marginBottom: 8 }}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre (ex. Édit royal sur les péages)"
        />
      )}
      <textarea
        className="input"
        style={{ minHeight: 90 }}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Prends la plume…"
      />
      {imageUrl && (
        <div className="img-prev" style={{ marginTop: 8 }}>
          <img src={imageUrl} alt="aperçu" />
          <button className="rm" type="button" onClick={() => { setImageFile(null); setImageUrl(null) }}>
            ✕
          </button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
        <button className="btn-seal" disabled={busy} onClick={submit}>
          ✒️ Publier
        </button>
        <label className="attach-btn">
          📎 Image
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={pickImage} />
        </label>
        {allowPrivate && (
          <button
            type="button"
            className={isPrivate ? 'tiny good' : 'tiny'}
            onClick={() => setIsPrivate((v) => !v)}
            title={isPrivate ? 'Visible seulement de ton royaume' : 'Visible de tous'}
          >
            {isPrivate ? '🔒 Privé (ton royaume)' : '🌍 Public'}
          </button>
        )}
        <button
          type="button"
          className={isHrp ? 'tiny good' : 'tiny'}
          onClick={() => setIsHrp((v) => !v)}
          title={isHrp ? 'Message hors-roleplay' : 'Message en roleplay'}
        >
          {isHrp ? 'HRP' : 'RP'}
        </button>
        {status && <span className="sent-ok">{status}</span>}
      </div>
    </div>
  )
}

/* ── Détail d'un post + commentaires ───────────────────────────────────── */

function PostDetail({
  postId,
  meId,
  isAdmin,
  mayComment,
  onBack,
  onDeleted,
}: {
  postId: string
  meId: string
  isAdmin: boolean
  mayComment: boolean
  onBack: () => void
  onDeleted: () => void
}) {
  const [post, setPost] = useState<PostRow | null>(null)
  const [comments, setComments] = useState<CommentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editingC, setEditingC] = useState<string | null>(null)
  const [editCText, setEditCText] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [{ data }, cs] = await Promise.all([
      supabase
        .from('posts')
        .select('id, channel, author_profile, title, body, image_path, created_at, updated_at, pinned, is_private, is_hrp, author:profiles!posts_author_profile_fkey(id, character_name, house)')
        .eq('id', postId)
        .maybeSingle(),
      listComments(postId),
    ])
    setPost((data as unknown as PostRow | null) ?? null)
    setComments(cs)
    setLoading(false)
  }, [postId])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Temps réel : commentaires (ajout/édition/suppression) et le post lui-même
  // (édité, épinglé, ou supprimé par un autre joueur / un Mestre).
  useEffect(() => {
    const ch = supabase
      .channel(`post:${postId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` },
        () => listComments(postId).then(setComments).catch(() => {}),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts', filter: `id=eq.${postId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') onDeleted()
          else loadAll()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [postId, loadAll, onDeleted])

  async function send() {
    if (!text.trim()) return
    setBusy(true)
    try {
      await addComment({ meId, postId, body: text })
      setText('')
      setComments(await listComments(postId))
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="empty">Décachetage…</div>
  if (!post) return <div className="empty">Ce post est introuvable.</div>

  const h = getHouse(post.author?.house)
  const img = publicImageUrl(post.image_path)
  const canEdit = post.author_profile === meId || isAdmin
  const canDeletePost = isAdmin // un joueur ne retire pas ses propres traces
  const edited = !!post.updated_at && post.updated_at !== post.created_at
  const channelKind = getChannel(post.channel)?.kind
  const useTitle = channelKind === 'decree' || channelKind === 'lore'

  return (
    <div>
      <button className="linkbtn" onClick={onBack}>
        ← Retour au salon
      </button>

      <div className="parchment reading" style={{ marginTop: 14 }}>
        <div className="pm-head">
          <Seal house={post.author?.house} size="lg" />
          <div style={{ flex: 1 }}>
            {post.pinned && <span className="pin-tag">📌 Épinglé</span>}
            {post.is_hrp && <span className="pin-tag" style={{ background: '#2a2f3a', color: '#9DB4D0' }}>HRP</span>}
            {post.is_private && <span className="pin-tag" style={{ background: '#3a2a2a', color: '#E0B0B0' }}>🔒 Privé · ton royaume</span>}
            {post.title && <h2 className="pm-subj">{post.title}</h2>}
            <p className="pm-meta">
              {post.author?.character_name ?? 'Inconnu'} · Maison {h.nom} · {fmtDate(post.created_at)}
              {edited && <span style={{ fontStyle: 'normal', color: 'var(--muted)' }}> · modifié</span>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {canEdit && (
              <button className="tiny" onClick={() => setPinned(post.id, !post.pinned).then(loadAll)}>
                📌 {post.pinned ? 'Désépingler' : 'Épingler'}
              </button>
            )}
            {canEdit && !editing && (
              <button
                className="tiny"
                onClick={() => {
                  setEditTitle(post.title ?? '')
                  setEditBody(post.body)
                  setEditing(true)
                }}
              >
                ✏️ Éditer
              </button>
            )}
            {post.author_profile !== meId && (
              <ReportButton meId={meId} targetType="post" targetId={post.id} />
            )}
            {canDeletePost && (
              <button className="tiny danger" onClick={() => deletePost(post.id).then(onDeleted)}>
                🗑️ Supprimer
              </button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="pm-body">
            {useTitle && (
              <input
                className="input"
                style={{ marginBottom: 8 }}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Titre"
              />
            )}
            <textarea
              className="input"
              style={{ minHeight: 150 }}
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button
                className="btn-seal"
                onClick={async () => {
                  if (!editBody.trim()) return
                  await updatePost(post.id, { title: editTitle, body: editBody })
                  setEditing(false)
                  await loadAll()
                }}
              >
                💾 Enregistrer
              </button>
              <button className="btn-ghost" onClick={() => setEditing(false)}>
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <div className="pm-body">{post.title ? <Lettrine>{post.body}</Lettrine> : post.body}</div>
        )}
        {!editing && img && <img className="letter-img" src={img} alt="pièce jointe" />}
      </div>

      <h3 className="section-h" style={{ fontSize: 12, marginTop: 26 }}>
        💬 {comments.length} commentaire{comments.length > 1 ? 's' : ''}
      </h3>

      <div className="comments">
        {comments.map((c) => {
          const ch = getHouse(c.author?.house)
          const mine = c.author_profile === meId
          return (
            <div key={c.id} className="comment">
              <Seal house={c.author?.house} size="sm" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="c-meta">
                  <span className="c-who">{c.author?.character_name ?? 'Inconnu'}</span>
                  <span className="c-house">Maison {ch.nom}</span>
                  <span className="c-date">
                    {fmtDate(c.created_at)}
                    {c.updated_at && c.updated_at !== c.created_at ? ' · modifié' : ''}
                  </span>
                  {!mine && <ReportButton meId={meId} targetType="comment" targetId={c.id} />}
                  {(mine || isAdmin) && (
                    <button
                      className="c-del"
                      title="Modifier"
                      onClick={() => { setEditingC(c.id); setEditCText(c.body) }}
                    >
                      ✏️
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      className="c-del"
                      title="Supprimer"
                      onClick={() => deleteComment(c.id).then(() => listComments(postId).then(setComments))}
                    >
                      ✕
                    </button>
                  )}
                </div>
                {editingC === c.id ? (
                  <div style={{ marginTop: 6 }}>
                    <textarea
                      className="input"
                      style={{ minHeight: 60 }}
                      value={editCText}
                      onChange={(e) => setEditCText(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <button
                        className="tiny good"
                        onClick={async () => {
                          if (!editCText.trim()) return
                          await updateComment(c.id, editCText)
                          setEditingC(null)
                          await loadAll()
                        }}
                      >
                        Enregistrer
                      </button>
                      <button className="tiny" onClick={() => setEditingC(null)}>
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="c-body">{c.body}</div>
                )}
              </div>
            </div>
          )
        })}
        {!comments.length && <div className="empty" style={{ padding: 24 }}>Aucun commentaire.</div>}
      </div>

      {mayComment ? (
        <div className="replybox">
          <textarea
            className="input"
            style={{ minHeight: 70 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ajoute un commentaire…"
          />
          <div style={{ marginTop: 8 }}>
            <button className="btn-seal" disabled={busy} onClick={send}>
              💬 Commenter
            </button>
          </div>
        </div>
      ) : (
        <p className="hint">Mode observateur — lecture seule.</p>
      )}
    </div>
  )
}
