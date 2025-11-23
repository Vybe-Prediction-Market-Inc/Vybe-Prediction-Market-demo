'use client';

import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useUserBalanceHistory } from '@/hooks/useUserDashboard';

type TimeRange = '7d' | '30d';

interface UserBalanceChartProps {
  address?: `0x${string}`;
}

export default function UserBalanceChart({ address }: UserBalanceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const days = timeRange === '7d' ? 7 : 30;

  const { data, loading } = useUserBalanceHistory(address, days);

  if (loading) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-[var(--muted)]">Loading balance data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-body">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-[var(--fg)]">Net Profit/Loss Over Time</h2>
            <p className="text-sm text-[var(--muted)] mt-1">
              Cumulative P&L
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
            <LineChart
              data={data}
              margin={{ top: 5, right: 10, left: 20, bottom: 5 }}
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
                axisLine={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 2 }}
                tick={{ fill: 'var(--muted)' }}
              />
              <YAxis
                stroke="var(--muted)"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 2 }}
                tickFormatter={(value) => `${value > 0 ? '+' : ''}${value}`}
                label={{
                  value: 'ETH',
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
                labelStyle={{ color: 'var(--muted)' }}
                formatter={(value: number) => [
                  `${value > 0 ? '+' : ''}${value} ETH`,
                  value >= 0 ? 'Profit' : 'Loss'
                ]}
              />
              {/* Reference line at y=0 - the origin */}
              <Line
                type="monotone"
                dataKey={() => 0}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 5"
              />
              {/* Actual P&L line */}
              <Line
                type="monotone"
                dataKey="balance"
                stroke="#1ED760"
                strokeWidth={3}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const color = payload.balance >= 0 ? '#1ED760' : '#FCD34D';
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill={color}
                      stroke={color}
                      strokeWidth={2}
                    />
                  );
                }}
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
