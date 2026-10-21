import { MessageCircleQuestion } from 'lucide-react'
import { FlagDot } from './FlagSummary.jsx'
import { useT } from '../i18n/index.jsx'

export default function Questions({ questions }) {
  const t = useT()
  return (
    <section aria-labelledby="questions-heading" className="pop reveal bg-lilac p-5 sm:p-7">
      <h2 id="questions-heading" className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
        <MessageCircleQuestion aria-hidden strokeWidth={2.75} /> {t('q.heading')}
      </h2>
      <p className="mt-1 text-ink/70">{t('q.intro')}</p>
      <ol className="mt-5 space-y-3">
        {questions.map((q, i) => (
          <li key={q.id} className="pop-sm flex items-start gap-3 bg-paper p-4">
            <span className="w-5 shrink-0 font-display text-xl font-extrabold text-bubblegum">{t.num(i + 1)}</span>
            <p className="min-w-0 flex-1 font-medium">{q.text}</p>
            {q.level !== 'general' && <FlagDot level={q.level} size="mt-1.5 h-3 w-3" />}
          </li>
        ))}
      </ol>
    </section>
  )
}
