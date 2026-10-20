import { Info } from 'lucide-react'

export const DISCLAIMER = 'Based on public records, not advice.'

export default function Disclaimer({ className = '' }) {
  return (
    <p className={`inline-flex items-center gap-2 rounded-full border-2 border-ink bg-paper px-4 py-1.5 text-sm font-bold ${className}`}>
      <Info aria-hidden size={16} strokeWidth={2.5} />
      {DISCLAIMER}
    </p>
  )
}
