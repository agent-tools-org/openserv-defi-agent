import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock viem before importing the module
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem')
  return {
    ...actual as object,
    createPublicClient: vi.fn(() => ({
      readContract: vi.fn()
    })),
    http: vi.fn()
  }
})

import { analyzePool, computePrice, createViemClient, analyzePoolInputSchema } from '../src/capabilities/pool-analyzer.js'

function makeMockClient(overrides: Partial<Record<string, unknown>> = {}) {
  const defaults: Record<string, unknown> = {
    token0: '0x4200000000000000000000000000000000000006',
    token1: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    fee: 500,
    slot0: [BigInt('1392486909633467119786647344128'), 201234, 0, 0, 0, 0, true],
    liquidity: BigInt('5000000000000000000'),
    symbol_0: 'WETH',
    decimals_0: 18,
    symbol_1: 'USDC',
    decimals_1: 6
  }
  const vals = { ...defaults, ...overrides }

  let callCount = 0
  const tokenCalls: string[] = []

  return {
    readContract: vi.fn().mockImplementation(({ functionName, address }: { functionName: string; address: string }) => {
      if (functionName === 'token0') return Promise.resolve(vals.token0)
      if (functionName === 'token1') return Promise.resolve(vals.token1)
      if (functionName === 'fee') return Promise.resolve(vals.fee)
      if (functionName === 'slot0') return Promise.resolve(vals.slot0)
      if (functionName === 'liquidity') return Promise.resolve(vals.liquidity)
      if (functionName === 'symbol') {
        tokenCalls.push(address)
        return Promise.resolve(tokenCalls.length <= 1 ? vals.symbol_0 : vals.symbol_1)
      }
      if (functionName === 'decimals') {
        callCount++
        return Promise.resolve(callCount <= 1 ? vals.decimals_0 : vals.decimals_1)
      }
      return Promise.reject(new Error(`Unknown function: ${functionName}`))
    })
  } as unknown as ReturnType<typeof createViemClient>
}

describe('pool-analyzer', () => {
  it('returns structured pool analysis with correct fields', async () => {
    const client = makeMockClient()
    const result = await analyzePool('0xPool', client)

    expect(result.poolAddress).toBe('0xPool')
    expect(result.token0.symbol).toBe('WETH')
    expect(result.token1.symbol).toBe('USDC')
    expect(result.fee).toBe(500)
    expect(result.tick).toBe(201234)
    expect(typeof result.price).toBe('string')
    expect(typeof result.liquidity).toBe('string')
    expect(typeof result.volume24hEstimate).toBe('string')
  })

  it('computes price from sqrtPriceX96', () => {
    // sqrtPriceX96 = 2^96 means price = 1.0
    const sqrtPriceX96 = BigInt(2) ** BigInt(96)
    const price = computePrice(sqrtPriceX96, 18, 18)
    expect(Number(price)).toBeCloseTo(1.0, 4)
  })

  it('adjusts price for different decimals', () => {
    const sqrtPriceX96 = BigInt(2) ** BigInt(96)
    // token0 has 18 decimals, token1 has 6 — adjusted = rawPrice * 10^(18-6)
    const price = computePrice(sqrtPriceX96, 18, 6)
    expect(Number(price)).toBeGreaterThan(1)
  })

  it('validates input schema accepts valid pool address', () => {
    const result = analyzePoolInputSchema.safeParse({ poolAddress: '0xabc123' })
    expect(result.success).toBe(true)
  })

  it('rejects input schema with missing poolAddress', () => {
    const result = analyzePoolInputSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('includes volume estimate based on liquidity and fee', async () => {
    const client = makeMockClient({ liquidity: BigInt('10000000000000000000'), fee: 3000 })
    const result = await analyzePool('0xBigPool', client)
    expect(parseFloat(result.volume24hEstimate)).toBeGreaterThanOrEqual(0)
  })
})
