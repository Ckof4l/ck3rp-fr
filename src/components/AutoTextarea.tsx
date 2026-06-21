import { useEffect, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

/* ============================================================================
   Zone de texte qui grandit avec son contenu (jusqu'à une hauteur max, puis
   défile). Évite d'« écrire à l'aveugle » dans un petit champ fixe.
   ========================================================================== */

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & { maxHeight?: number }

export function AutoTextarea({ value, maxHeight = 260, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const h = Math.min(el.scrollHeight, maxHeight)
    el.style.height = h + 'px'
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [value, maxHeight])

  // Réajuste après le premier rendu (police chargée, largeur définitive).
  useEffect(() => {
    const el = ref.current
    if (el) el.dispatchEvent(new Event('input'))
  }, [])

  return <textarea ref={ref} value={value} {...rest} />
}
