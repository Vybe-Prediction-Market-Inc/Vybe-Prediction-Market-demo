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
  timestamp?: number; // When bet was placed
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

interface PLDataPoint {
  date: string;
  pnl: number; // Can be negative - cumulative profit/loss
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

          // Fetch BetPlaced event logs to get timestamps for each bet
          const betPlacedEvent = VYBE_CONTRACT_ABI.find(
            (entry) => entry.type === 'event' && entry.name === 'BetPlaced'
          );

          let betTimestamps: Record<number, number> = {};
          if (betPlacedEvent) {
            try {
              const logs = await client.getLogs({
                address: addr,
                event: betPlacedEvent as any,
                args: {
                  user: address,
                },
                fromBlock: 'earliest',
                toBlock: 'latest',
              });

              // Get block timestamps for each log
              for (const log of logs) {
                const args = (log as any).args;
                if (!args) continue;
                
                const marketId = Number(args.marketId);
                if (!betTimestamps[marketId] && log.blockNumber) {
                  const block = await client.getBlock({ blockNumber: log.blockNumber });
                  betTimestamps[marketId] = Number(block.timestamp);
                }
              }
            } catch (logErr) {
              console.warn('Failed to fetch bet timestamps from events:', logErr);
            }
          }

          for (let i = 0; i < rows.length; i++) {
            const b = rows[i];
            const mr = marketResults[i];
            const marketId = Number(b.marketId);
            
            all.push({
              contractAddress: addr,
              marketId,
              betYes: b.betYes,
              amount: b.amount as bigint,
              claimed: b.claimed,
              // Use timestamp from contract if available, otherwise from event logs
              timestamp: b.timestamp ? Number(b.timestamp) : betTimestamps[marketId],
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
    const now = Date.now();
    const nowSec = Math.floor(now / 1000);
    
    if (loading) {
      // Generate empty data points while loading
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

    // If no bets, show zeros
    if (!bets.length) {
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

    // Calculate cumulative P&L over time (can be negative!)
    // P&L = Total claimed winnings - Total amount bet
    const dataPoints: BalanceDataPoint[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const timestamp = now - i * 24 * 60 * 60 * 1000;
      const timestampSec = Math.floor(timestamp / 1000);
      const date = new Date(timestamp);

      let totalBet = 0;
      let totalWon = 0;

      // Calculate P&L based on what happened up to this point
      for (const bet of bets) {
        const betTimestamp = bet.timestamp;
        const betDeadline = bet.deadline;

        // Skip if we don't have timestamp data
        if (!betTimestamp) continue;

        // Only include bets placed before this timestamp
        if (betTimestamp <= timestampSec) {
          const betAmount = parseFloat(formatEther(bet.amount));
          totalBet += betAmount;

          // Check if bet was resolved and won by this timestamp
          if (bet.resolved && betDeadline && betDeadline <= timestampSec) {
            const userWon = bet.betYes === bet.outcomeYes;
            if (userWon && bet.claimed) {
              // Approximate payout (would need pool data for exact calculation)
              // For now, assume 2x payout for simplicity
              // In reality, you'd calculate: (userShares / winningPool) * totalPool
              totalWon += betAmount * 2; // Simplified assumption
            }
          }
        }
      }

      const pnl = totalWon - totalBet; // Can be negative!

      dataPoints.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        balance: parseFloat(pnl.toFixed(4)), // Using balance field for P&L
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

// Hook for bets per market over time (for vertical bar chart with dates on X-axis)
interface DateWinLossDataPoint {
  date: string;
  timestamp: number;
  wins: number;
  losses: number;
}

export function useUserWinsLossesByMarket(address?: `0x${string}`, days: number = 7) {
  const { bets, loading } = useUserDashboardData(address);
  const [data, setData] = useState<DateWinLossDataPoint[]>([]);

  useEffect(() => {
    if (loading) {
      setData([]);
      return;
    }

    if (!bets.length) {
      setData([]);
      return;
    }

    const now = Date.now();
    
    // Generate date labels and initialize data points
    const dataPoints: DateWinLossDataPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const timestamp = now - i * 24 * 60 * 60 * 1000;
      const date = new Date(timestamp);
      dataPoints.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        timestamp,
        wins: 0,
        losses: 0,
      });
    }

    // Count wins and losses per date (based on when market was resolved)
    for (const bet of bets) {
      if (!bet.resolved || !bet.deadline) continue;
      
      // Use the deadline (resolution time) instead of bet placement time
      const resolutionTimestampSec = bet.deadline;
      const isWin = bet.betYes === bet.outcomeYes;

      // Find which date this market was resolved
      for (let i = 0; i < dataPoints.length; i++) {
        const dp = dataPoints[i];
        const dayStart = new Date(new Date(dp.timestamp).setHours(0, 0, 0, 0)).getTime() / 1000;
        const dayEnd = dayStart + 86400;

        if (resolutionTimestampSec >= dayStart && resolutionTimestampSec < dayEnd) {
          if (isWin) {
            dp.wins++;
          } else {
            dp.losses++;
          }
          break;
        }
      }
    }

    setData(dataPoints);
  }, [bets, loading, days]);

  return { data, loading };
}
