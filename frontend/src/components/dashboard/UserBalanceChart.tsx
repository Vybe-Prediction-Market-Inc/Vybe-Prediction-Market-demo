'use client';

import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type TimeRange = '7d' | '30d';

interface BalanceDataPoint {
  date: string;
  balance: number;
}

interface UserBalanceChartProps {
  address?: string;
}

// Mock data generator - will be replaced with useUserBalanceHistory(address) hook
function generateMockData(days: number): BalanceDataPoint[] {
  const data: BalanceDataPoint[] = [];
  const now = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Generate mock balance with some variation
    const baseBalance = 0.5;
    const variation = Math.sin(i * 0.5) * 0.2 + Math.random() * 0.1;
    const balance = Math.max(0, baseBalance + variation);
    
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      balance: parseFloat(balance.toFixed(4)),
    });
  }
  
  return data;
}

export default function UserBalanceChart({ address }: UserBalanceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  
  // TODO: Replace with actual hook call
  // const { data, isLoading } = useUserBalanceHistory(address);
  const data = generateMockData(timeRange === '7d' ? 7 : 30);

  return (
    <div className="card">
      <div className="card-body">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-[var(--fg)]">Balance Over Time</h2>
            <p className="text-sm text-[var(--muted)] mt-1">
              Total ETH balance in active bets
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
                tickFormatter={(value) => `${value} ETH`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(25, 20, 20, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'var(--fg)',
                }}
                labelStyle={{ color: 'var(--muted)' }}
                formatter={(value: number) => [`${value} ETH`, 'Balance']}
              />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="#1ED760"
                strokeWidth={3}
                dot={{ fill: '#1ED760', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#1ED760', strokeWidth: 2, fill: '#1ED760' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
