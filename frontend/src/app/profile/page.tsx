'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatEther } from 'viem';
import { useAccount, usePublicClient } from 'wagmi';
import { VYBE_CONTRACT_ABI, discoverVybeContracts } from '@/lib/contract';

const profileTabs = [
  { key: 'live', label: 'Live Now' },
  { key: 'unsettled', label: 'Unsettled' },
  { key: 'settled', label: 'Settled' },
  { key: 'all', label: 'All' },
] as const;

type TabKey = (typeof profileTabs)[number]['key'];
type PositionBucket = Exclude<TabKey, 'all'>;
type MarketTuple = [string, string, bigint, bigint, boolean, boolean, bigint, bigint];

type Position = {
  id: string;
  contractAddress: `0x${string}`;
  marketId: number;
  question?: string;
  side: 'YES' | 'NO';
  amount: bigint;
  claimed: boolean;
  resolved?: boolean;
  outcomeYes?: boolean;
  deadline?: number;
  yesPool?: bigint;
  noPool?: bigint;
  bucket: PositionBucket;
  claimable: boolean;
};

const shortAddr = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

const formatEth = (value?: bigint) => {
  if (value === undefined) return '—';
  const num = Number(formatEther(value));
  if (Number.isNaN(num)) return `${value.toString()} wei`;
  const precision = num >= 1 ? 3 : 6;
  return `${num.toFixed(precision)} ETH`;
};

const formatRelativeTime = (target?: number) => {
  if (!target) return '—';
  const now = Math.floor(Date.now() / 1000);
  const diff = target - now;
  const abs = Math.abs(diff);
  const minutes = Math.floor(abs / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return diff >= 0 ? `in ${days}d ${hours % 24}h` : `${days}d ${hours % 24}h ago`;
  if (hours > 0) return diff >= 0 ? `in ${hours}h ${minutes % 60}m` : `${hours}h ${minutes % 60}m ago`;
  if (minutes > 0) return diff >= 0 ? `in ${minutes}m` : `${minutes}m ago`;
  return diff >= 0 ? 'soon' : 'just now';
};

const statusLabelFor = (position: Position) => {
  if (position.claimable) {
    // Check if this is a refund (no opponents) or a real win
    const isRefund = (position.side === 'YES' && position.noPool === BigInt(0)) ||
                     (position.side === 'NO' && position.yesPool === BigInt(0));
    if (isRefund) {
      return 'No opponents · refund available';
    }
    return 'Won · ready to redeem';
  }
  if (position.resolved) {
    if (position.outcomeYes !== undefined) {
      const won = position.outcomeYes ? position.side === 'YES' : position.side === 'NO';
      if (won) {
        // Check if it was a refund
        const isRefund = (position.side === 'YES' && position.noPool === BigInt(0)) ||
                         (position.side === 'NO' && position.yesPool === BigInt(0));
        if (isRefund) {
          return position.claimed ? 'Refunded' : 'Refund available';
        }
        return position.claimed ? 'Won · claimed' : 'Won';
      }
      return position.claimed ? 'Lost · settled' : 'Lost';
    }
    return position.claimed ? 'Settled' : 'Resolved';
  }
  if (typeof position.deadline === 'number' && position.deadline <= Math.floor(Date.now() / 1000)) {
    return 'Awaiting resolution';
  }
  return 'Live';
};

const actionLabelFor = (position: Position) => {
  if (position.claimable) {
    // Check if this is a refund
    const isRefund = (position.side === 'YES' && position.noPool === BigInt(0)) ||
                     (position.side === 'NO' && position.yesPool === BigInt(0));
    return isRefund ? 'Claim Refund' : 'Redeem';
  }
  if (position.bucket === 'unsettled') return 'Awaiting Resolution';
  if (position.bucket === 'settled') return position.claimed ? 'View Receipt' : 'View Result';
  return 'View Market';
};

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient();
  const [activeTab, setActiveTab] = useState<TabKey>('live');
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    if (!address) {
      setPositions([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const nowSec = Math.floor(Date.now() / 1000);
      try {
        const addrs = await discoverVybeContracts(client);
        const next: Position[] = [];

        for (const addr of addrs) {
          const bytecode = await client.getBytecode({ address: addr });
          if (!bytecode || bytecode === '0x') continue;

          const bets = (await client.readContract({
            address: addr,
            abi: VYBE_CONTRACT_ABI,
            functionName: 'getUserBets',
            args: [address],
          })) as any[];
          if (!Array.isArray(bets) || bets.length === 0) continue;

          const ids = bets.map((b) => Number(b.marketId));
          const marketReads = ids.map(
            (id) =>
              client.readContract({
                address: addr,
                abi: VYBE_CONTRACT_ABI,
                functionName: 'getMarket',
                args: [BigInt(id)],
              }) as Promise<MarketTuple>
          );
          const marketResults = await Promise.allSettled(marketReads);

          bets.forEach((bet, i) => {
            const mr = marketResults[i];
            const market = mr.status === 'fulfilled' ? mr.value : null;
            const deadline = market ? Number(market[3]) : undefined;
            const resolved = market ? Boolean(market[4]) : undefined;
            const outcomeYes = market ? Boolean(market[5]) : undefined;
            const yesPool = market ? market[6] : undefined;
            const noPool = market ? market[7] : undefined;
            const isClosedByTime = typeof deadline === 'number' && deadline <= nowSec;
            const isClaimable = Boolean(resolved && !bet.claimed && market && bet.betYes === market[5]);

            let bucket: PositionBucket;
            if (resolved === true) {
              bucket = isClaimable ? 'unsettled' : 'settled';
            } else if (isClosedByTime) {
              bucket = 'unsettled';
            } else {
              bucket = 'live';
            }

            next.push({
              id: `${addr}-${String(bet.marketId)}`,
              contractAddress: addr,
              marketId: Number(bet.marketId),
              question: market ? market[0] : undefined,
              side: bet.betYes ? 'YES' : 'NO',
              amount: bet.amount as bigint,
              claimed: bet.claimed,
              resolved,
              outcomeYes,
              deadline,
              yesPool,
              noPool,
              bucket,
              claimable: isClaimable,
            });
          });
        }

        if (!cancelled) setPositions(next);
      } catch (err) {
        console.error('Error loading positions:', err);
        if (!cancelled) setError((err as Error)?.message ?? 'Failed to load positions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [client, address]);

  const filteredPositions = useMemo(
    () => (activeTab === 'all' ? positions : positions.filter((position) => position.bucket === activeTab)),
    [activeTab, positions]
  );

  const activeTabLabel = profileTabs.find((tab) => tab.key === activeTab)?.label ?? 'All';

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="card">
        <div className="card-body">
          <h1 className="h2">Your Profile</h1>
          <p className="mt-1 muted">Manage your identity and activity.</p>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm muted">Wallet</div>
              <div className="mt-1 font-mono">{isConnected ? address : 'Not connected'}</div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm muted">Stats</div>
              <div className="mt-1">PnL: — • Markets: — • Volume: —</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="h2">Positions</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Pulled directly from your Vybe markets on-chain. Buckets update as markets open, close, and settle.
            </p>
          </div>
        </div>

        <div className="mt-4">
          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-4 border-b border-white/10">
          {profileTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative pb-3 text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'text-[var(--fg)]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute inset-x-0 -bottom-[1px] h-[2px] rounded-full bg-[var(--brand)]" />
              )}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-4">
          {loading && positions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center">
              <p className="font-medium">Loading positions from the contract…</p>
              <p className="mt-1 text-sm text-[var(--muted)]">This can take a few seconds while we scan your markets.</p>
            </div>
          ) : filteredPositions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center">
              <p className="font-medium">
                {isConnected ? `No ${activeTabLabel.toLowerCase()} positions yet.` : 'Connect your wallet to view positions.'}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {isConnected
                  ? 'When you trade markets that fall into this bucket, they will show up here.'
                  : 'Your on-chain markets will appear once a wallet is connected.'}
              </p>
            </div>
          ) : (
            filteredPositions.map((position) => {
              const deadlineText =
                position.deadline === undefined
                  ? 'No deadline found'
                  : position.deadline <= Math.floor(Date.now() / 1000)
                    ? `Ended ${formatRelativeTime(position.deadline)}`
                    : `Ends ${formatRelativeTime(position.deadline)}`;
              const poolText =
                position.yesPool !== undefined && position.noPool !== undefined
                  ? `Yes ${formatEth(position.yesPool)} / No ${formatEth(position.noPool)}`
                  : 'Pool data unavailable';

              return (
                <div
                  key={position.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-lg shadow-black/10 transition hover:border-[var(--brand)]/60"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                        Market #{position.marketId} · {shortAddr(position.contractAddress)}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold">{position.question ?? 'Untitled market'}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {position.claimable && (
                        <span className="inline-flex items-center rounded-full bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100">
                          Claimable
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
                          position.side === 'YES'
                            ? 'bg-emerald-400/10 text-emerald-200'
                            : 'bg-rose-400/10 text-rose-200'
                        }`}
                      >
                        {position.side}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
                    <div>
                      <div className="text-xs uppercase text-[var(--muted)]">Stake</div>
                      <div className="font-medium">{formatEth(position.amount)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-[var(--muted)]">Status</div>
                      <div className="font-medium">{statusLabelFor(position)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-[var(--muted)]">Pools</div>
                      <div className="font-medium">{poolText}</div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--muted)]">{deadlineText}</span>
                    <a
                      href={`/event?address=${position.contractAddress}&id=${position.marketId}`}
                      className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium transition hover:border-[var(--brand)]/70 hover:bg-[var(--brand)]/10"
                    >
                      {actionLabelFor(position)}
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
