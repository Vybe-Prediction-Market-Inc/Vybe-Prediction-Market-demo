import { Abi, type AbiEvent, type PublicClient } from "viem";

export const VYBE_CONTRACT_ABI: Abi = [
  {
    type: "event",
    name: "MarketCreated",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true },
      { name: "question", type: "string", indexed: false },
      { name: "trackId", type: "string", indexed: false },
      { name: "threshold", type: "uint256", indexed: false },
      { name: "deadline", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "BetPlaced",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "yes", type: "bool", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "function",
    name: "marketCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
  type: "function",
  name: "buyYes",
  stateMutability: "payable",
  inputs: [{ name: "marketId", type: "uint256" }],
  outputs: [],
  },
  {
  type: "function",
  name: "buyNo",
  stateMutability: "payable",
  inputs: [{ name: "marketId", type: "uint256" }],
  outputs: [],
  },
  {
  type: "function",
  name: "redeem",
  stateMutability: "nonpayable",
  inputs: [{ name: "marketId", type: "uint256" }],
  outputs: [],
  },
  {
  type: "function",
  name: "getUserBets",
  stateMutability: "view",
  inputs: [{ name: "_user", type: "address" }],
  outputs: [
    {
      components: [
        { name: "marketId", type: "uint256" },
        { name: "betYes", type: "bool" },
        { name: "amount", type: "uint256" },
        { name: "claimed", type: "bool" },
        { name: "timestamp", type: "uint256" },
      ],
      type: "tuple[]",
    },
  ],
  },
  {
    type: "function",
    name: "getMarket",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [
      { name: "question", type: "string" },
      { name: "trackId", type: "string" },
      { name: "threshold", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "resolved", type: "bool" },
      { name: "outcomeYes", type: "bool" },
      { name: "yesPool", type: "uint256" },
      { name: "noPool", type: "uint256" },
    ],
  },
];

const MARKET_CREATED_EVENT = VYBE_CONTRACT_ABI.find(
  (entry): entry is AbiEvent => entry.type === 'event' && entry.name === 'MarketCreated'
);

type HexAddress = `0x${string}`;

function parseAddressList(raw?: string | null): HexAddress[] {
  if (!raw || raw.trim().length === 0) return [];
  const trimmed = raw.trim();
  const addrs: HexAddress[] = [];
  const pushIfValid = (value: unknown) => {
    if (typeof value === 'string' && value.startsWith('0x') && value.length === 42) {
      addrs.push(value as HexAddress);
    }
  };

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      parsed.forEach(pushIfValid);
      return addrs;
    }
    if (typeof parsed === 'string') {
      pushIfValid(parsed);
      return addrs;
    }
  } catch {
    // fall through to CSV parsing
  }

  trimmed
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach(pushIfValid);

  return addrs;
}

export function getConfiguredContractAddresses(): HexAddress[] {
  const envMulti =
    process.env.NEXT_PUBLIC_VYBE_CONTRACT_ADDRESSES ??
    process.env.VYBE_CONTRACT_ADDRESSES;
  const envSingle =
    process.env.NEXT_PUBLIC_VYBE_CONTRACT_ADDRESS ??
    process.env.VYBE_CONTRACT_ADDRESS;

  const addrs = parseAddressList(envMulti);
  if (addrs.length === 0 && envSingle && envSingle.startsWith('0x')) {
    addrs.push(envSingle as HexAddress);
  }
  return addrs;
}

async function validateContracts(
  client: PublicClient,
  addresses: HexAddress[]
): Promise<HexAddress[]> {
  if (addresses.length === 0) return [];
  const checks = addresses.map(async (addr) => {
    try {
      const bytecode = await client.getBytecode({ address: addr });
      if (!bytecode || bytecode === '0x') return null;
      await client.readContract({
        address: addr,
        abi: VYBE_CONTRACT_ABI,
        functionName: 'marketCount',
        args: [],
      });
      return addr;
    } catch {
      return null;
    }
  });
  const results = await Promise.all(checks);
  return results.filter((addr): addr is HexAddress => !!addr);
}

// Discover VybePredictionMarket contract addresses by scanning MarketCreated
// logs (preferred) or by using explicitly configured addresses.
export async function discoverVybeContracts(
  client: PublicClient,
  opts?: { startBlock?: bigint; maxBlocks?: number }
): Promise<HexAddress[]> {
  // 1) Respect explicitly configured contract addresses for deterministic envs.
  const configured = await validateContracts(client, getConfiguredContractAddresses());
  if (configured.length > 0) return configured;

  // 2) Fallback to log-based discovery.
  const latest = await client.getBlockNumber();
  const envStart = process.env.NEXT_PUBLIC_SCAN_START_BLOCK;
  const envMax = process.env.NEXT_PUBLIC_SCAN_BLOCKS;
  const maxBlocks = opts?.maxBlocks ?? (envMax ? Number(envMax) : 5000);
  const minBlock = latest > BigInt(maxBlocks) ? latest - BigInt(maxBlocks) : BigInt(0);
  const fromBlock =
    opts?.startBlock ??
    (envStart && envStart.trim().length > 0 ? BigInt(envStart) : minBlock);

  if (!MARKET_CREATED_EVENT) return [];

  try {
    const logs = await client.getLogs({
      fromBlock,
      toBlock: latest,
      event: MARKET_CREATED_EVENT,
    });
    const unique = Array.from(
      new Set(logs.map((log) => log.address as HexAddress))
    );
    const validated = await validateContracts(client, unique);
    if (validated.length > 0) return validated;
  } catch (err) {
    console.warn('Vybe contract auto-discovery via logs failed:', err);
  }

  return [];
}
