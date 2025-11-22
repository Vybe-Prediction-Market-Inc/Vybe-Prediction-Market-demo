'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface BetDistribution {
  yes: number;
  no: number;
}

interface UserBetsPieChartProps {
  address?: string;
}

// Mock data generator - will be replaced with useUserYesNoDistribution(address) hook
function generateMockData(): BetDistribution {
  return {
    yes: 12,
    no: 8,
  };
}

const COLORS = {
  yes: '#1ED760', // Bright green
  no: '#FCD34D',  // Yellow
};

export default function UserBetsPieChart({ address }: UserBetsPieChartProps) {
  // TODO: Replace with actual hook call
  // const { data, isLoading } = useUserYesNoDistribution(address);
  const distribution = generateMockData();

  const total = distribution.yes + distribution.no;
  const chartData = [
    { name: 'YES', value: distribution.yes, percentage: ((distribution.yes / total) * 100).toFixed(1) },
    { name: 'NO', value: distribution.no, percentage: ((distribution.no / total) * 100).toFixed(1) },
  ];

  const renderCustomLabel = (entry: any) => {
    return `${entry.percentage}%`;
  };

  return (
    <div className="card h-full">
      <div className="card-body">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-[var(--fg)]">Bet Distribution</h2>
          <p className="text-sm text-[var(--muted)] mt-1">
            YES vs NO bets
          </p>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.name === 'YES' ? COLORS.yes : COLORS.no}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(25, 20, 20, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'var(--fg)',
                }}
                formatter={(value: number, name: string) => [value, name]}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                formatter={(value, entry: any) => (
                  <span style={{ color: 'var(--fg)', fontSize: '14px' }}>
                    {value}: {entry.payload.value} ({entry.payload.percentage}%)
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-white/5 p-3 border border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.yes }} />
              <span className="text-sm text-[var(--muted)]">YES Bets</span>
            </div>
            <div className="text-2xl font-semibold text-[var(--fg)] mt-1">
              {distribution.yes}
            </div>
          </div>
          <div className="rounded-lg bg-white/5 p-3 border border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.no }} />
              <span className="text-sm text-[var(--muted)]">NO Bets</span>
            </div>
            <div className="text-2xl font-semibold text-[var(--fg)] mt-1">
              {distribution.no}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
