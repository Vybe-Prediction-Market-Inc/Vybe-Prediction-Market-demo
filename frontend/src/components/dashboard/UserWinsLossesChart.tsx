'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useUserWinsLosses } from '@/hooks/useUserDashboard';

interface UserWinsLossesChartProps {
  address?: `0x${string}`;
}

const COLORS = {
  wins: '#1ED760',  // Green
  losses: '#FCD34D', // Yellow
};

export default function UserWinsLossesChart({ address }: UserWinsLossesChartProps) {
  const { data, loading } = useUserWinsLosses(address, 7);

  if (loading) {
    return (
      <div className="card h-full">
        <div className="card-body">
          <h2 className="text-xl font-semibold text-[var(--fg)]">Wins & Losses</h2>
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-[var(--muted)]">Loading performance data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card h-full">
      <div className="card-body">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-[var(--fg)]">Wins & Losses</h2>
          <p className="text-sm text-[var(--muted)] mt-1">
            Daily performance (in 0.001 ETH units)
          </p>
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
                label={{ 
                  value: 'Units (×0.001 ETH)', 
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
                formatter={(value: number, name: string) => {
                  const ethValue = (value * 0.001).toFixed(4);
                  return [`${value} (${ethValue} ETH)`, name === 'wins' ? 'Wins' : 'Losses'];
                }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                iconType="circle"
                formatter={(value) => (
                  <span style={{ color: 'var(--fg)', fontSize: '14px' }}>
                    {value === 'wins' ? 'Wins' : 'Losses'}
                  </span>
                )}
              />
              <Bar 
                dataKey="wins" 
                fill={COLORS.wins}
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="losses" 
                fill={COLORS.losses}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-white/5 p-3 border border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.wins }} />
              <span className="text-sm text-[var(--muted)]">Total Wins</span>
            </div>
            <div className="text-2xl font-semibold text-[var(--fg)] mt-1">
              {data.reduce((sum, d) => sum + d.wins, 0)}
            </div>
            <div className="text-xs text-[var(--muted)] mt-1">
              {(data.reduce((sum, d) => sum + d.wins, 0) * 0.001).toFixed(4)} ETH
            </div>
          </div>
          <div className="rounded-lg bg-white/5 p-3 border border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.losses }} />
              <span className="text-sm text-[var(--muted)]">Total Losses</span>
            </div>
            <div className="text-2xl font-semibold text-[var(--fg)] mt-1">
              {data.reduce((sum, d) => sum + d.losses, 0)}
            </div>
            <div className="text-xs text-[var(--muted)] mt-1">
              {(data.reduce((sum, d) => sum + d.losses, 0) * 0.001).toFixed(4)} ETH
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
