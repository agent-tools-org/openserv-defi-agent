import { createPublicClient, http, type Address, formatUnits } from 'viem'
import { base } from 'viem/chains'
import { z } from 'zod'
import { config } from '../config.js'

export const analyzePoolInputSchema = z.object({
  poolAddress: z.string().describe('Uniswap V3 pool contract address on Base')
})

export type PoolAnalysis = {
  poolAddress: string
  token0: { address: string; symbol: string; decimals: number }
  token1: { address: string; symbol: string; decimals: number }
  fee: number
  sqrtPriceX96: string
  price: string
  liquidity: string
  tick: number
  volume24hEstimate: string
}

const POOL_ABI = [
  { inputs: [], name: 'token0', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'token1', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'fee', outputs: [{ type: 'uint24' }], stateMutability: 'view', type: 'function' },
  {
    inputs: [], name: 'slot0',
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'observationIndex', type: 'uint16' },
      { name: 'observationCardinality', type: 'uint16' },
      { name: 'observationCardinalityNext', type: 'uint16' },
      { name: 'feeProtocol', type: 'uint8' },
      { name: 'unlocked', type: 'bool' }
    ],
    stateMutability: 'view', type: 'function'
  },
  { inputs: [], name: 'liquidity', outputs: [{ type: 'uint128' }], stateMutability: 'view', type: 'function' }
] as const

const ERC20_ABI = [
  { inputs: [], name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' }
] as const

export function createViemClient(rpcUrl?: string) {
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl ?? config.baseRpcUrl)
  })
}

export async function analyzePool(
  poolAddress: string,
  client?: ReturnType<typeof createViemClient>
): Promise<PoolAnalysis> {
  const viem = client ?? createViemClient()
  const addr = poolAddress as Address

  const [token0Addr, token1Addr, fee, slot0, liquidity] = await Promise.all([
    viem.readContract({ address: addr, abi: POOL_ABI, functionName: 'token0' }),
    viem.readContract({ address: addr, abi: POOL_ABI, functionName: 'token1' }),
    viem.readContract({ address: addr, abi: POOL_ABI, functionName: 'fee' }),
    viem.readContract({ address: addr, abi: POOL_ABI, functionName: 'slot0' }),
    viem.readContract({ address: addr, abi: POOL_ABI, functionName: 'liquidity' })
  ])

  const [sym0, dec0, sym1, dec1] = await Promise.all([
    viem.readContract({ address: token0Addr, abi: ERC20_ABI, functionName: 'symbol' }),
    viem.readContract({ address: token0Addr, abi: ERC20_ABI, functionName: 'decimals' }),
    viem.readContract({ address: token1Addr, abi: ERC20_ABI, functionName: 'symbol' }),
    viem.readContract({ address: token1Addr, abi: ERC20_ABI, functionName: 'decimals' })
  ])

  const sqrtPriceX96 = slot0[0]
  const tick = Number(slot0[1])
  const price = computePrice(sqrtPriceX96, dec0, dec1)

  return {
    poolAddress,
    token0: { address: token0Addr, symbol: sym0, decimals: dec0 },
    token1: { address: token1Addr, symbol: sym1, decimals: dec1 },
    fee: Number(fee),
    sqrtPriceX96: sqrtPriceX96.toString(),
    price,
    liquidity: liquidity.toString(),
    tick,
    volume24hEstimate: estimateVolume(liquidity, fee)
  }
}

export function computePrice(sqrtPriceX96: bigint, dec0: number, dec1: number): string {
  const num = Number(sqrtPriceX96) / 2 ** 96
  const rawPrice = num * num
  const adjusted = rawPrice * 10 ** (dec0 - dec1)
  return adjusted.toPrecision(8)
}

function estimateVolume(liquidity: bigint, fee: number): string {
  const liq = Number(formatUnits(liquidity, 18))
  const feeRate = fee / 1_000_000
  const estimate = liq * feeRate * 24
  return estimate.toFixed(2)
}
