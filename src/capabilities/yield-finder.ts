import { createPublicClient, http, type Address, formatUnits } from 'viem'
import { base } from 'viem/chains'
import { z } from 'zod'
import { config } from '../config.js'

export const findYieldInputSchema = z.object({
  token: z.string().describe('Token symbol or address to find yield for (e.g. WETH, USDC)')
})

export type YieldOpportunity = {
  protocol: string
  pool: string
  token: string
  apy: number
  tvl: string
  risk: 'low' | 'medium' | 'high'
}

export type YieldResult = {
  token: string
  opportunities: YieldOpportunity[]
  queriedAt: string
}

/** Known lending protocol rate data sources on Base */
const PROTOCOL_CONFIGS: ProtocolConfig[] = [
  {
    name: 'Aave V3',
    pool: 'Base Main Market',
    rateProvider: '0x2d8A3C5677189723C4cB8873CfC9C8976FDF38Ac' as Address,
    risk: 'low' as const,
    baseApy: 3.2
  },
  {
    name: 'Compound V3',
    pool: 'Base USDC Market',
    rateProvider: '0xb125E6687d4313864e53df431d5425969c15Eb2F' as Address,
    risk: 'low' as const,
    baseApy: 4.1
  },
  {
    name: 'Moonwell',
    pool: 'Base Lending',
    rateProvider: '0x0000000000000000000000000000000000000000' as Address,
    risk: 'medium' as const,
    baseApy: 5.5
  },
  {
    name: 'Seamless',
    pool: 'Base ILM',
    rateProvider: '0x0000000000000000000000000000000000000000' as Address,
    risk: 'medium' as const,
    baseApy: 6.8
  },
  {
    name: 'Extra Finance',
    pool: 'Base Leveraged Yield',
    rateProvider: '0x0000000000000000000000000000000000000000' as Address,
    risk: 'high' as const,
    baseApy: 12.4
  }
]

type ProtocolConfig = {
  name: string
  pool: string
  rateProvider: Address
  risk: 'low' | 'medium' | 'high'
  baseApy: number
}

const TOKEN_MULTIPLIERS: Record<string, number> = {
  WETH: 0.85,
  ETH: 0.85,
  USDC: 1.0,
  USDbC: 0.95,
  DAI: 0.9,
  cbETH: 1.1,
  wstETH: 1.15
}

export function createYieldClient(rpcUrl?: string) {
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl ?? config.baseRpcUrl)
  })
}

export async function findYield(
  token: string,
  client?: ReturnType<typeof createYieldClient>
): Promise<YieldResult> {
  const viem = client ?? createYieldClient()
  const normalizedToken = resolveToken(token)
  const multiplier = TOKEN_MULTIPLIERS[normalizedToken] ?? 0.7

  const opportunities: YieldOpportunity[] = await Promise.all(
    PROTOCOL_CONFIGS.map(async (proto) => {
      const apy = await estimateApy(viem, proto, multiplier)
      const tvl = await estimateTvl(viem, proto)
      return {
        protocol: proto.name,
        pool: proto.pool,
        token: normalizedToken,
        apy: Math.round(apy * 100) / 100,
        tvl,
        risk: proto.risk
      }
    })
  )

  opportunities.sort((a, b) => b.apy - a.apy)

  return {
    token: normalizedToken,
    opportunities,
    queriedAt: new Date().toISOString()
  }
}

function resolveToken(input: string): string {
  const upper = input.toUpperCase()
  const aliases: Record<string, string> = {
    ETH: 'WETH',
    'WRAPPED ETHER': 'WETH',
    'USD COIN': 'USDC',
    WETH: 'WETH',
    USDC: 'USDC',
    USDBC: 'USDbC',
    DAI: 'DAI',
    CBETH: 'cbETH',
    WSTETH: 'wstETH'
  }
  return aliases[upper] ?? upper
}

async function estimateApy(
  _client: ReturnType<typeof createYieldClient>,
  proto: ProtocolConfig,
  multiplier: number
): Promise<number> {
  // In production, read on-chain supply/borrow rates from the rate provider.
  // For this version we use known base APYs adjusted per token.
  return proto.baseApy * multiplier
}

async function estimateTvl(
  _client: ReturnType<typeof createYieldClient>,
  proto: ProtocolConfig
): Promise<string> {
  // In production, read TVL from on-chain or an indexer.
  // Placeholder estimates based on known protocol sizes on Base.
  const tvlEstimates: Record<string, string> = {
    'Aave V3': '$245M',
    'Compound V3': '$182M',
    'Moonwell': '$95M',
    'Seamless': '$42M',
    'Extra Finance': '$18M'
  }
  return tvlEstimates[proto.name] ?? 'N/A'
}

export { resolveToken, PROTOCOL_CONFIGS, TOKEN_MULTIPLIERS }
