'use client';

import { useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { formatEther } from 'viem';
import { VYBE_CONTRACT_ABI, discoverVybeContracts } from '@/lib/contract';

interface UserBet {
  contractAddress: `0x${string}`;
  marketId: number;
  betYes: boolean;
  amount: bigint;
  claimed: boolean;
  question?: string;
  deadline?: number;
  resolved?: boolean;
  outcomeYes?: boolean;
}

interface BalanceDataPoint {
  date: string;
  balance: number;
  timestamp: number;
}

interface BetDistribution {
  yes: number;
  no: number;
}

interface WinLossDataPoint {
  date: string;
  wins: number;
  losses: number;
  timestamp: number;
}

export function useUserDashboardData(address?: `0x${string}`) {
  const client = usePublicClient();
  const [bets, setBets] = useState<UserBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client || !address) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadBets = async () => {
      try {
        setLoading(true);
        setError(null);

        const addrs = await discoverVybeContracts(client);
        const all: UserBet[] = [];

        for (const addr of addrs) {
          const bytecode = await client.getBytecode({ address: addr });
          if (!bytecode || bytecode === '0x') continue;

          const result = await client.readContract({
            address: addr,
            abi: VYBE_CONTRACT_ABI,
            functionName: 'getUserBets',
            args: [address],
          });

          const rows = result as any[];
          if (!rows || rows.length === 0) continue;

          // Fetch market details in parallel
          const ids = rows.map((b) => Number(b.marketId));
          const marketReads = ids.map((id) =>
            client.readContract({
              address: addr,
              abi: VYBE_CONTRACT_ABI,
              functionName: 'getMarket',
              args: [BigInt(id)],
            }) as Promise<[string, string, bigint, bigint, boolean, boolean, bigint, bigint]>
          );
          const marketResults = await Promise.allSettled(marketReads);

          for (let i = 0; i < rows.length; i++) {
            const b = rows[i];
            const mr = marketResults[i];
            
            all.push({
              contractAddress: addr,
              marketId: Number(b.marketId),
              betYes: b.betYes,
              amount: b.amount as bigint,
              claimed: b.claimed,
              question: mr.status === 'fulfilled' ? mr.value[0] : undefined,
              deadline: mr.status === 'fulfilled' ? Number(mr.value[3]) : undefined,
              resolved: mr.status === 'fulfilled' ? Boolean(mr.value[4]) : undefined,
              outcomeYes: mr.status === 'fulfilled' ? Boolean(mr.value[5]) : undefined,
            });
          }
        }

        if (!cancelled) {
          setBets(all);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading user bets:', err);
          setError((err as Error)?.message ?? 'Failed to load bets');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadBets();

    return () => {
      cancelled = true;
    };
  }, [client, address]);

  return { bets, loading, error };
}

// Hook for balance over time chart
export function useUserBalanceHistory(address?: `0x${string}`, days: number = 7) {
  const { bets, loading } = useUserDashboardData(address);
  const [data, setData] = useState<BalanceDataPoint[]>([]);

  useEffect(() => {
    if (loading || !bets.length) {
      // Generate empty data points
      const now = Date.now();
      const emptyData: BalanceDataPoint[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const timestamp = now - i * 24 * 60 * 60 * 1000;
        const date = new Date(timestamp);
        emptyData.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          balance: 0,
          timestamp,
        });
      }
      setData(emptyData);
      return;
    }

    // Calculate balance at each day
    const now = Date.now();
    const dataPoints: BalanceDataPoint[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const timestamp = now - i * 24 * 60 * 60 * 1000;
      const timestampSec = Math.floor(timestamp / 1000);
      const date = new Date(timestamp);

      // Sum all active (unclaimed) bets that existed at this point in time
      let balance = 0;
      for (const bet of bets) {
        // Check if bet was active at this timestamp
        const betDeadline = bet.deadline ?? Number.MAX_SAFE_INTEGER;
        const isResolved = bet.resolved ?? false;
        
        // Bet is active if it hasn't been claimed and either:
        // - Not resolved yet, or
        // - Resolved but deadline hasn't passed
        if (!bet.claimed && timestampSec <= betDeadline) {
          balance += parseFloat(formatEther(bet.amount));
        }
      }

      dataPoints.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        balance: parseFloat(balance.toFixed(4)),
        timestamp,
      });
    }

    setData(dataPoints);
  }, [bets, loading, days]);

  return { data, loading };
}

// Hook for YES/NO bet distribution
export function useUserYesNoDistribution(address?: `0x${string}`) {
  const { bets, loading } = useUserDashboardData(address);
  const [distribution, setDistribution] = useState<BetDistribution>({ yes: 0, no: 0 });

  useEffect(() => {
    if (loading) {
      setDistribution({ yes: 0, no: 0 });
      return;
    }

    const yes = bets.filter(b => b.betYes).length;
    const no = bets.filter(b => !b.betYes).length;

    setDistribution({ yes, no });
  }, [bets, loading]);

  return { distribution, loading };
}

// Hook for wins/losses over time
export function useUserWinsLosses(address?: `0x${string}`, days: number = 7) {
  const { bets, loading } = useUserDashboardData(address);
  const [data, setData] = useState<WinLossDataPoint[]>([]);

  useEffect(() => {
    if (loading) {
      // Generate empty data points
      const now = Date.now();
      const emptyData: WinLossDataPoint[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const timestamp = now - i * 24 * 60 * 60 * 1000;
        const date = new Date(timestamp);
        emptyData.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          wins: 0,
          losses: 0,
          timestamp,
        });
      }
      setData(emptyData);
      return;
    }

    const now = Date.now();
    const dataPoints: WinLossDataPoint[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const timestamp = now - i * 24 * 60 * 60 * 1000;
      const date = new Date(timestamp);
      const dayStart = new Date(date.setHours(0, 0, 0, 0)).getTime() / 1000;
      const dayEnd = dayStart + 86400;

      let wins = 0;
      let losses = 0;

      // Only count resolved bets
      for (const bet of bets) {
        if (!bet.resolved || !bet.deadline) continue;

        const betDeadlineSec = bet.deadline;
        
        // Check if this bet was resolved on this day
        if (betDeadlineSec >= dayStart && betDeadlineSec < dayEnd) {
          const amountEth = parseFloat(formatEther(bet.amount));
          const units = Math.round(amountEth * 1000); // Convert to 1/1000 ETH units

          // Check if user won or lost
          const userWon = bet.betYes === bet.outcomeYes;
          
          if (userWon) {
            wins += units;
          } else {
            losses += units;
          }
        }
      }

      dataPoints.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        wins,
        losses,
        timestamp,
      });
    }

    setData(dataPoints);
  }, [bets, loading, days]);

  return { data, loading };
}
