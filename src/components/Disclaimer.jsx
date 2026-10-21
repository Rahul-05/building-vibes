import { Info } from 'lucide-react'
import { useT } from '../i18n/index.jsx'

export default function Disclaimer({ className = '' }) {
  const t = useT()
  return (
    // Smaller on phones so it stays one line; the fixed radius means that if a very narrow screen
    // does wrap it, the chip becomes a rounded box rather than a pinched pill.
    <p className={`inline-flex max-w-full items-center gap-2 rounded-[1.1rem] border-2 border-ink bg-paper px-3 py-1.5 text-start text-xs font-bold sm:px-4 sm:text-sm ${className}`}>
      <Info aria-hidden size={16} strokeWidth={2.5} className="shrink-0" />
      {t('disclaimer')}
    </p>
  )
}
