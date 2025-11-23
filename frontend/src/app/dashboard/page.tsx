'use client';

import { useAccount } from 'wagmi';
import UserBalanceChart from '@/components/dashboard/UserBalanceChart';
import UserBetsPieChart from '@/components/dashboard/UserBetsPieChart';
import UserWinsLossesChart from '@/components/dashboard/UserWinsLossesChart';

export default function DashboardPage() {
  const { address, isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="card">
          <div className="card-body text-center">
            <h1 className="text-2xl font-semibold text-[var(--fg)]">Dashboard</h1>
            <p className="mt-4 text-[var(--muted)]">
              Please connect your wallet to view your dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <section className="card">
        <div className="card-body">
          <h1 className="text-3xl font-bold text-[var(--fg)]">Dashboard</h1>
          <p className="mt-2 text-[var(--muted)]">
            Track your betting performance and portfolio balance
          </p>
        </div>
      </section>

      {/* Line Chart - Full Width */}
      <section>
        <UserBalanceChart address={address} />
      </section>

      {/* Pie Chart and Bar Chart - Side by Side on Desktop */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UserBetsPieChart address={address} />
        <UserWinsLossesChart address={address} />
      </section>
    </div>
  );
}
