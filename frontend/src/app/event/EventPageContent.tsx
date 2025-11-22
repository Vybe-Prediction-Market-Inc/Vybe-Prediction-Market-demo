
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { VYBE_CONTRACT_ABI, discoverVybeContracts } from '@/lib/contract';

interface Market {
  id: number;
  question: string;
  trackId: string;
  threshold: number;
  deadline: number;
  resolved: boolean;
  outcomeYes: boolean;
  yesPool: bigint;
  noPool: bigint;
}

interface BetInfo {
  marketId: number;
  betYes: boolean;
  amount: bigint;
  claimed: boolean;
}

type MarketTuple = [
  string,
  string,
  bigint,
  bigint,
  boolean,
  boolean,
  bigint,
  bigint
];

export default function EventPageContent() {
  const search = useSearchParams();
  const id = Number(search.get('id') ?? 1);
  const fromUrl = search.get('address') as `0x${string}` | null;
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { address: connectedAddress, isConnected } = useAccount();

  const [market, setMarket] = useState<Market | null>(null);
  const [userBet, setUserBet] = useState<BetInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addr, setAddr] = useState<`0x${string}` | null>(fromUrl && fromUrl.startsWith('0x') ? fromUrl : null);

  // If no address from URL or env, try to discover automatically
  useEffect(() => {
    if (addr || !client) return;
    let cancelled = false;
    const run = async () => {
      try {
        const discovered = await discoverVybeContracts(client);
        if (!cancelled && discovered.length > 0) {
          // pick the most recent (last) discovered contract
          setAddr(discovered[discovered.length - 1]);
        }
      } catch {
        // ignore
      }
    };
    run();
    return () => { cancelled = true; };
  }, [addr, client]);

  // --- Fetch Market Data ---
  useEffect(() => {
    if (!client) return;

    const fetchMarket = async () => {
      try {
        setError(null);
        // Preflight checks to avoid `returned no data (0x)`
        if (!addr) {
          setError('Contract address not set or discoverable. Deploy a market or pass ?address=0x... to load a specific contract.');
          return;
        }

        const chainId = await client.getChainId();
        console.log('[Event] chainId=', chainId, 'address=', addr, 'marketId=', id);

        const bytecode = await client.getBytecode({ address: addr });
        if (!bytecode || bytecode === '0x') {
          setError(`No contract code found at ${addr}. Is the node fresh and was the contract deployed to this chain?`);
          return;
        }

        const mc = await client.readContract({
          address: addr,
          abi: VYBE_CONTRACT_ABI,
          functionName: 'marketCount',
          args: [],
        }) as bigint;
        if (mc === BigInt(0)) {
          setError('No markets exist yet. Run the deploy script to create a demo market.');
          return;
        }
        if (BigInt(id) > mc) {
          setError(`Market ${id} does not exist (marketCount=${mc}).`);
          return;
        }

        const result = await client.readContract({
          address: addr,
          abi: VYBE_CONTRACT_ABI,
          functionName: 'getMarket',
          args: [BigInt(id)],
        }) as MarketTuple;

        const [
          question,
          trackId,
          threshold,
          deadline,
          resolved,
          outcomeYes,
          yesPool,
          noPool,
        ] = result;

        setMarket({
          id,
          question,
          trackId,
          threshold: Number(threshold),
          deadline: Number(deadline),
          resolved,
          outcomeYes,
          yesPool: yesPool,
          noPool: noPool,
        });
      } catch (err) {
        console.error('Error fetching market:', err);
        setError((err as Error)?.message ?? 'Failed to fetch market');
      }
    };

    fetchMarket();
  }, [client, id, addr]);

  // --- Fetch user's bet info (to check if already claimed) ---
  useEffect(() => {
    if (!client || !isConnected || !connectedAddress || !addr) return;

    const loadUserBet = async () => {
      try {
        const result = await client.readContract({
          address: addr,
          abi: VYBE_CONTRACT_ABI,
          functionName: 'getUserBets',
          args: [connectedAddress],
        }) as any[];

        const parsed = result.map((b: any) => ({
          marketId: Number(b.marketId),
          betYes: b.betYes,
          amount: b.amount as bigint,
          claimed: b.claimed,
        })) as BetInfo[];

        const thisMarketBet = parsed.find((b) => b.marketId === id);
        if (thisMarketBet) setUserBet(thisMarketBet);
      } catch (err) {
        console.error('Error loading user bet:', err);
      }
    };

    loadUserBet();
  }, [client, connectedAddress, id, isConnected, addr]);

  // --- Place Bet ---
  const handleBet = async (betYes: boolean) => {
    try {
      setLoading(true);
      setError(null);
      if (!isConnected || !connectedAddress) {
        setError('Connect your wallet to place a bet.');
        return;
      }
      if (!client) {
        setError('RPC client not ready.');
        return;
      }
      if (!addr) {
        setError('Contract address unavailable.');
        return;
      }
      const functionName = betYes ? 'buyYes' : 'buyNo';
      const sim = await client.simulateContract({
        address: addr,
        abi: VYBE_CONTRACT_ABI,
        functionName,
        args: [BigInt(id)],
        account: connectedAddress,
        value: parseEther('0.001'),
      });
      const tx = await writeContractAsync({ ...sim.request });
      console.log('Bet tx:', tx);
    } catch (err) {
      console.error('Bet failed:', err);
      setError((err as Error)?.message ?? 'Bet transaction failed');
    } finally {
      setLoading(false);
    }
  };

  // --- Redeem Winnings ---
  const handleRedeem = async () => {
    try {
      setRedeeming(true);
      setError(null);
      if (!isConnected || !connectedAddress) {
        setError('Connect your wallet to redeem.');
        return;
      }
      if (!client) {
        setError('RPC client not ready.');
        return;
      }
      if (!addr) {
        setError('Contract address unavailable.');
        return;
      }
      const sim = await client.simulateContract({
        address: addr,
        abi: VYBE_CONTRACT_ABI,
        functionName: 'redeem',
        args: [BigInt(id)],
        account: connectedAddress,
      });
      const tx = await writeContractAsync({ ...sim.request });
      console.log('Redeem tx:', tx);
      setUserBet((prev) => (prev ? { ...prev, claimed: true } : prev));
    } catch (err) {
      console.error('Redeem failed:', err);
      setError((err as Error)?.message ?? 'Redeem failed');
    } finally {
      setRedeeming(false);
    }
  };

  // Keep closed markets accessible: no redirect; users can view details and redeem if applicable.

  if (error)
    return (
      <div className="p-6 text-center text-red-400">
        <p className="font-semibold mb-2">Error loading market</p>
        <pre className="text-sm opacity-80">{error}</pre>
      </div>
    );

  if (!market) return <p className="p-8 text-center">Loading market...</p>;

  const nowSec = Math.floor(Date.now() / 1000);
  const isClosed = market.resolved || market.deadline <= nowSec;
  const alreadyClaimed = userBet?.claimed ?? false;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <section className="card">
        <div className="card-body">
          <div className="text-sm muted flex items-center gap-2">
            <span>Market #{id}</span>
            {isClosed && (
              <span className="inline-flex items-center rounded-full bg-white/10 text-white/70 text-[10px] px-2 py-0.5">Closed</span>
            )}
          </div>
          <h1 className="h2 mt-1">{market.question}</h1>
          <p className="mt-2 muted">Track ID: {market.trackId}</p>
          {addr && (
            <p className="mt-1 text-xs text-white/40 break-all">Contract: {addr}</p>
          )}

          <div className="mt-4 text-sm">
            <div>Yes Pool: {formatEther(market.yesPool)} ETH</div>
            <div>No Pool: {formatEther(market.noPool)} ETH</div>
          </div>

          {/* Bet buttons */}
          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            <button
              onClick={() => handleBet(true)}
              disabled={
                loading || (!!userBet && userBet.betYes === false)
              }
              className={`btn rounded-full ${userBet?.betYes === true ? 'btn-primary' : 'btn-outline'}`}
            >
              {loading ? 'Processing...' : (isClosed ? 'Betting closed' : 'Bet Yes (0.001 ETH)')}
            </button>

            <button
              onClick={() => handleBet(false)}
              disabled={
                loading || isClosed || (!!userBet && userBet.betYes === true)
              }
              className={`btn rounded-full ${userBet?.betYes === false ? 'btn-ghost' : 'btn-outline'}`}
            >
              {loading ? 'Processing...' : (isClosed ? 'Betting closed' : 'Bet No (0.001 ETH)')}
            </button>
          </div>

          {/* Claim Winnings/Refund Button (visible only after market is resolved) */}
          {market.resolved && userBet && userBet.betYes === market.outcomeYes && (
            <div className="mt-8 text-center">
              {(() => {
                // Check if this is a refund scenario
                const isRefund = (userBet.betYes && market.noPool === BigInt(0)) ||
                                 (!userBet.betYes && market.yesPool === BigInt(0));
                
                if (alreadyClaimed) {
                  return (
                    <div className="text-green-400 text-sm font-semibold">
                      {isRefund ? 'Refund Claimed' : 'Already Claimed'}
                    </div>
                  );
                }
                
                return (
                  <>
                    {isRefund && (
                      <p className="text-amber-300 text-sm mb-3">
                        No opponents placed bets on the other side. You can claim a refund of your stake.
                      </p>
                    )}
                    <button
                      onClick={handleRedeem}
                      disabled={!isConnected || redeeming}
                      className="btn btn-success rounded-full"
                    >
                      {redeeming ? 'Claiming...' : (isRefund ? 'Claim Refund' : 'Claim Winnings')}
                    </button>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
