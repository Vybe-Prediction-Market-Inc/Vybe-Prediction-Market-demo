"use client";

import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import { useMarkets } from "@/hooks/useMarkets";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { VYBE_CONTRACT_ABI } from "@/lib/contract";

type MarketTuple = [
  string,   // question
  string,   // trackId
  bigint,   // threshold
  bigint,   // deadline
  boolean,  // resolved
  boolean,  // outcomeYes
  bigint,   // yesPool
  bigint    // noPool
];

interface Market {
  id: number;
  question: string;
  trackId: string;
  threshold: number;
  deadline: number;
  resolved: boolean;
  outcomeYes: boolean;
  yesPool: number;
  noPool: number;
}

export default function ExplorePage() {
  const { markets, loading, error } = useMarkets();
  const client = usePublicClient();
  const { address: connectedAddress, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  // Static timestamp per mount (no live countdown)
  const nowSecRef = useRef(Math.floor(Date.now() / 1000));
  const nowSec = nowSecRef.current;
  const [redeemingKeys, setRedeemingKeys] = useState<Set<string>>(new Set());
  // Synchronous in-flight guard to prevent double-click duplicate calls
  const inFlightRedeemsRef = useRef<Set<string>>(new Set());

  type UserBet = { betYes: boolean; amount: bigint; claimed: boolean };
  const [userBets, setUserBets] = useState<Record<string, Record<number, UserBet>>>({});

  const formatRemaining = (seconds: number) => {
    if (seconds <= 0) return "0s";
    const d = Math.floor(seconds / 86400);
    seconds %= 86400;
    const h = Math.floor(seconds / 3600);
    seconds %= 3600;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const sortedMarkets = useMemo(() => {
    if (!markets) return [] as typeof markets;
    const arr = [...markets];
    arr.sort((a, b) => {
      const aClosed = a.resolved || a.deadline <= nowSec;
      const bClosed = b.resolved || b.deadline <= nowSec;

      const betA = (userBets[a.contractAddress] || {})[a.marketId];
      const redeemA = Boolean(a.resolved && betA && !betA.claimed && (betA.amount > BigInt(0)) && (betA.betYes === a.outcomeYes));
      const betB = (userBets[b.contractAddress] || {})[b.marketId];
      const redeemB = Boolean(b.resolved && betB && !betB.claimed && (betB.amount > BigInt(0)) && (betB.betYes === b.outcomeYes));

      // 1) Redeemable first
      if (redeemA !== redeemB) return redeemA ? -1 : 1;
      // 2) Open first
      if (aClosed !== bClosed) return aClosed ? 1 : -1;
      // 3) Soonest deadline
      return a.deadline - b.deadline;
    });
    return arr;
  }, [markets, nowSec, userBets]);

  // Stable, order-insensitive list and key of unique contract addresses
  const contractAddresses = useMemo(() => {
    if (!markets) return [] as string[];
    const set = new Set<string>();
    for (const m of markets) set.add(m.contractAddress);
    return Array.from(set).sort();
  }, [markets]);

  const contractsKey = useMemo(() => contractAddresses.join("|"), [contractAddresses]);

  // Load user's bets for each discovered contract to enable redeem button
  useEffect(() => {
    if (!client || !isConnected || !connectedAddress || contractAddresses.length === 0) return;
    const addrs = contractAddresses;

    let cancelled = false;
    const run = async () => {
      try {
        const entries = await Promise.all(
          addrs.map(async (addr) => {
            try {
              const code = await client.getBytecode({ address: addr as `0x${string}` });
              if (!code || code === '0x') return null;
              const rows = await client.readContract({
                address: addr as `0x${string}`,
                abi: VYBE_CONTRACT_ABI,
                functionName: 'getUserBets',
                args: [connectedAddress],
              }) as any[];
              const map: Record<number, UserBet> = {};
              for (const r of rows) {
                const id = Number(r.marketId);
                map[id] = { betYes: r.betYes, amount: r.amount as bigint, claimed: r.claimed };
              }
              return [addr, map] as const;
            } catch {
              return null;
            }
          })
        );

        const next: Record<string, Record<number, UserBet>> = {};
        for (const entry of entries) {
          if (!entry) continue;
          const [addr, map] = entry;
          next[addr] = map;
        }
        if (!cancelled) setUserBets(next);
      } catch (e) {
        // ignore softly
        console.warn('Failed to load user bets for explore:', e);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [client, isConnected, connectedAddress, contractsKey]);

  const handleRedeem = async (e: React.MouseEvent, contractAddress: `0x${string}`, marketId: number) => {
    // prevent parent Link navigation when clicking inside cards
    e.preventDefault();
    e.stopPropagation();
    if (!client || !isConnected || !connectedAddress) return;
    const key = `${contractAddress}-${marketId}`;
    // Synchronous guard to avoid duplicate simulate/tx from fast double-clicks
    if (inFlightRedeemsRef.current.has(key)) return;
    inFlightRedeemsRef.current.add(key);
    try {
      setRedeemingKeys(prev => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      const sim = await client.simulateContract({
        address: contractAddress,
        abi: VYBE_CONTRACT_ABI,
        functionName: 'redeem',
        args: [BigInt(marketId)],
        account: connectedAddress,
      });
      await writeContractAsync({ ...sim.request });
      // Optimistically mark claimed
      setUserBets(prev => {
        const copy = { ...prev };
        const per = { ...(copy[contractAddress] || {}) };
        const existing = per[marketId];
        if (existing) per[marketId] = { ...existing, claimed: true };
        copy[contractAddress] = per;
        return copy;
      });
    } catch (err) {
      console.error('Redeem failed:', err);
    } finally {
      inFlightRedeemsRef.current.delete(key);
      setRedeemingKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  return (
    <div className="px-4 py-8 max-w-6xl mx-auto space-y-6">
      <h1 className="h1 mb-4">Explore Events</h1>
      <SearchBar placeholder="Search for artists, tracks, or markets..." onSearch={() => { }} />

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}
      {(!sortedMarkets || sortedMarkets.length === 0) && !loading ? (
        <p className="muted mt-4">No markets found.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedMarkets.map((market) => {
            const isClosed = market.resolved || market.deadline <= nowSec;
            const bet = (userBets[market.contractAddress] || {})[market.marketId];
            const eligibleToRedeem = Boolean(
              market.resolved &&
              bet &&
              !bet.claimed &&
              (bet.amount > BigInt(0)) &&
              (bet.betYes === market.outcomeYes)
            );
            // Check if this is a refund scenario (no opponents on the other side)
            const isRefund = eligibleToRedeem && (
              (bet.betYes && market.noPool === BigInt(0)) ||
              (!bet.betYes && market.yesPool === BigInt(0))
            );
            const content = (
              <div className="card-body">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="h2 mb-2">{market.question}</h2>
                  {isClosed && (
                    <span className="inline-flex items-center rounded-full bg-white/10 text-white/70 text-[10px] px-2 py-0.5">
                      Closed
                    </span>
                  )}
                </div>
                <p className="muted text-xs mb-1">Market #{market.marketId} · {shortAddr(market.contractAddress)}</p>
                <p className="muted text-sm mb-1">Track ID: {market.trackId}</p>
                {!isClosed && (
                  <p className="text-xs text-white/70 mt-1">Ends in {formatRemaining(market.deadline - nowSec)}</p>
                )}
                {eligibleToRedeem && (
                  <div className="mt-3">
                    {isRefund && (
                      <p className="text-xs text-amber-300 mb-2">No opponents - refund available</p>
                    )}
                    <button
                      onClick={(e) => handleRedeem(e, market.contractAddress as `0x${string}`, market.marketId)}
                      className="btn btn-success rounded-full text-xs"
                      disabled={redeemingKeys.has(`${market.contractAddress}-${market.marketId}`)}
                    >
                      {redeemingKeys.has(`${market.contractAddress}-${market.marketId}`) 
                        ? 'Claiming…' 
                        : isRefund 
                          ? 'Claim Refund' 
                          : 'Redeem Winnings'}
                    </button>
                  </div>
                )}
              </div>
            );

            return isClosed ? (
              <div
                key={`${market.contractAddress}-${market.marketId}`}
                className={`card transition block focus:outline-none rounded-xl opacity-60 border-white/5 cursor-not-allowed`}
                aria-disabled
                tabIndex={-1}
                title={market.contractAddress}
              >
                {content}
              </div>
            ) : (
              <Link
                key={`${market.contractAddress}-${market.marketId}`}
                href={`/event?address=${market.contractAddress}&id=${market.marketId}`}
                className={`card transition block focus:outline-none rounded-xl hover:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]`}
                title={market.contractAddress}
              >
                {content}
              </Link>
            );
          })}

        </div>
      )}
    </div>
  );
}
