import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Reviews - ParchiVisa',
  description: 'User feedback and trust signals for ParchiVisa.',
}

const reviews = [
  {
    quote: 'The checklist helped me see exactly which documents needed attention before I submitted anything.',
    name: 'Student applicant',
  },
  {
    quote: 'Clear, practical, and not overhyped. It made the preparation process feel more manageable.',
    name: 'Graduate applicant',
  },
  {
    quote: 'The country-specific readiness view was useful for spotting gaps early.',
    name: 'International student',
  },
]

export default function ReviewsPage() {
  return (
    <div className="min-h-screen px-4 pt-28 sm:px-6">
      <section className="mx-auto max-w-5xl">
        <p className="section-label mb-3">Reviews</p>
        <h1 className="text-3xl font-bold text-white sm:text-4xl">What applicants value</h1>
        <p className="mt-4 max-w-2xl text-slate-400">
          ParchiVisa is designed to make preparation clearer. It is informational guidance, not legal advice or a guarantee of approval.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {reviews.map((review) => (
            <article key={review.name} className="glass rounded-2xl p-6">
              <p className="text-sm leading-relaxed text-slate-300">&ldquo;{review.quote}&rdquo;</p>
              <p className="mt-5 text-sm font-semibold text-white">{review.name}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
