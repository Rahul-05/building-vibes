import Mascot from './Mascot.jsx'

// Friendly full-width message for "address not found" and error states.
export default function StateMessage({ mood = 'mixed', title, children, action }) {
  return (
    <section className="flex flex-col items-center px-6 py-10 text-center" role="status">
      <Mascot mood={mood} className="h-48 w-48" />
      <h2 className="mt-4 text-3xl font-extrabold">{title}</h2>
      <div className="mt-2 max-w-md text-lg text-ink/75">{children}</div>
      {action && <div className="mt-6">{action}</div>}
    </section>
  )
}
