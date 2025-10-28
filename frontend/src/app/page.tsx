'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 space-y-10">
      <section className="mt-6 rounded-3xl bg-gradient-to-br from-[var(--brand)]/20 via-transparent to-[var(--brandAccent)]/15 border border-white/10 p-10">
        <h1 className="h1">Bet on what’s next with Vybe</h1>
        <p className="mt-3 text-lg muted max-w-2xl">
          Predict the next music trends. Trade on artists, tracks, and cultural moments.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/explore" className="btn btn-primary">Explore Markets</Link>
        </div>
      </section>

      {/* <section className="space-y-4">
        <h2 className="h2">Featured Markets</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Link key={i} href={`/event?slug=market-${i}`} className="card hover:border-white/20 transition">
              <div className="card-body">
                <div className="text-sm muted">Event #{i}</div>
                <div className="mt-1 font-semibold">Will Drake break the all-time streaming record this month?</div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm muted">Ends: 31 Dec</span>
                  <span className="rounded bg-[var(--brand)]/20 text-[var(--brand)] px-2 py-1 text-xs">
                    Hot
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section> */}
    </div>
  );
}
