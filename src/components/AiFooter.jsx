import { useT } from '../i18n/index.jsx'

// The "public record information, not advice" line under anything the AI helper wrote. The
// frontend adds it (not the Worker), so it reads right in every language.
export default function AiFooter({ className = '' }) {
  const t = useT()
  return <p className={`inline-block rounded-[1.1rem] border-2 border-ink bg-lilac px-4 py-1 text-sm font-bold ${className}`}>{t('ai.footer')}</p>
}
