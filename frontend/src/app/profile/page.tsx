'use client';

import { useAccount } from 'wagmi';

export default function ProfilePage() {
  const { address, isConnected } = useAccount();

  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* <section className="card">
        <div className="card-body">
          <h1 className="h2">Your Profile</h1>
          <p className="mt-1 muted">Manage your identity and activity.</p>

          <div className="mt-6 grid sm:grid-cols-2 gap-6">
            <div className="rounded-xl border border-white/10 p-4 bg-white/5">
              <div className="text-sm muted">Wallet</div>
              <div className="mt-1 font-mono">
                {isConnected ? address : 'Not connected'}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 p-4 bg-white/5">
              <div className="text-sm muted">Stats</div>
              <div className="mt-1">PnL: — • Markets: — • Volume: —</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 space-y-4">
        <h2 className="h2">Recent Activity</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-xl border border-white/10 p-4 bg-white/5">
              <div className="text-sm muted">Trade #{i}</div>
              <div className="mt-1">Bought “YES” @ 0.62 on BTC $100k</div>
              <div className="mt-2 text-sm muted">2h ago</div>
            </div>
          ))}
        </div>
      </section> */}
    </div>
  );
}
