'use client';

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useUserWinsLossesByMarket } from '@/hooks/useUserDashboard';

type TimeRange = '7d' | '30d';

interface UserWinsLossesChartProps {
  address?: `0x${string}`;
}

export default function UserWinsLossesChart({ address }: UserWinsLossesChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const days = timeRange === '7d' ? 7 : 30;
  const { data, loading } = useUserWinsLossesByMarket(address, days);

  if (loading) {
    return (
      <div className="card h-full">
        <div className="card-body">
          <h2 className="text-xl font-semibold text-[var(--fg)]">Wins & Losses per Market</h2>
          <div className="h-[400px] flex items-center justify-center">
            <p className="text-[var(--muted)]">Loading market data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="card h-full">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[var(--fg)]">Bets per Market Over Time</h2>
              <p className="text-sm text-[var(--muted)] mt-1">
                Daily bet count by market
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setTimeRange('7d')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  timeRange === '7d'
                    ? 'bg-[var(--brand)] text-[var(--bg)]'
                    : 'bg-white/5 text-[var(--muted)] hover:bg-white/10'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setTimeRange('30d')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  timeRange === '30d'
                    ? 'bg-[var(--brand)] text-[var(--bg)]'
                    : 'bg-white/5 text-[var(--muted)] hover:bg-white/10'
                }`}
              >
                30 Days
              </button>
            </div>
          </div>
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-[var(--muted)]">No bets to display</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card h-full">
      <div className="card-body">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-[var(--fg)]">Wins & Losses per Market</h2>
            <p className="text-sm text-[var(--muted)] mt-1">
              Daily wins and losses by market
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                timeRange === '7d'
                  ? 'bg-[var(--brand)] text-[var(--bg)]'
                  : 'bg-white/5 text-[var(--muted)] hover:bg-white/10'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                timeRange === '30d'
                  ? 'bg-[var(--brand)] text-[var(--bg)]'
                  : 'bg-white/5 text-[var(--muted)] hover:bg-white/10'
              }`}
            >
              30 Days
            </button>
          </div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                stroke="var(--muted)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--muted)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                label={{
                  value: 'Count',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: 'var(--muted)', fontSize: 12 }
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(25, 20, 20, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'var(--fg)',
                }}
                labelStyle={{ color: 'var(--muted)', marginBottom: '8px' }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                iconType="circle"
                formatter={(value) => (
                  <span style={{ color: 'var(--fg)', fontSize: '14px' }}>
                    {value}
                  </span>
                )}
              />
              <Bar
                dataKey="wins"
                name="Wins"
                fill="#22C55E"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="losses"
                name="Losses"
                fill="#EF4444"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4">
          <div className="rounded-lg bg-white/5 p-3 border border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--muted)]">Total Resolved Markets</span>
            </div>
            <div className="text-2xl font-semibold text-[var(--fg)] mt-1">
              {data.reduce((sum, d) => sum + d.wins + d.losses, 0)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
