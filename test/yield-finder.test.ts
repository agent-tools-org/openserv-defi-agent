import { describe, it, expect, vi } from 'vitest'

vi.mock('viem', async () => {
  const actual = await vi.importActual('viem')
  return {
    ...actual as object,
    createPublicClient: vi.fn(() => ({})),
    http: vi.fn()
  }
})

import {
  findYield,
  createYieldClient,
  findYieldInputSchema,
  resolveToken,
  PROTOCOL_CONFIGS,
  TOKEN_MULTIPLIERS
} from '../src/capabilities/yield-finder.js'

describe('yield-finder', () => {
  it('returns opportunities sorted by APY descending', async () => {
    const client = {} as ReturnType<typeof createYieldClient>
    const result = await findYield('WETH', client)

    for (let i = 1; i < result.opportunities.length; i++) {
      expect(result.opportunities[i - 1].apy).toBeGreaterThanOrEqual(result.opportunities[i].apy)
    }
  })

  it('returns all known protocols', async () => {
    const client = {} as ReturnType<typeof createYieldClient>
    const result = await findYield('USDC', client)
    expect(result.opportunities.length).toBe(PROTOCOL_CONFIGS.length)

    const names = result.opportunities.map((o) => o.protocol)
    for (const proto of PROTOCOL_CONFIGS) {
      expect(names).toContain(proto.name)
    }
  })

  it('resolves token aliases correctly', () => {
    expect(resolveToken('ETH')).toBe('WETH')
    expect(resolveToken('eth')).toBe('WETH')
    expect(resolveToken('usdc')).toBe('USDC')
    expect(resolveToken('wstETH')).toBe('wstETH')
    expect(resolveToken('UNKNOWN')).toBe('UNKNOWN')
  })

  it('applies correct multiplier per token', async () => {
    const client = {} as ReturnType<typeof createYieldClient>

    const wethResult = await findYield('WETH', client)
    const usdcResult = await findYield('USDC', client)

    // WETH multiplier is 0.85, USDC is 1.0, so USDC APYs should be higher
    const wethMax = Math.max(...wethResult.opportunities.map((o) => o.apy))
    const usdcMax = Math.max(...usdcResult.opportunities.map((o) => o.apy))
    expect(usdcMax).toBeGreaterThan(wethMax)
  })

  it('includes timestamp in result', async () => {
    const client = {} as ReturnType<typeof createYieldClient>
    const result = await findYield('WETH', client)
    expect(result.queriedAt).toBeTruthy()
    expect(new Date(result.queriedAt).getTime()).toBeGreaterThan(0)
  })

  it('validates input schema', () => {
    expect(findYieldInputSchema.safeParse({ token: 'WETH' }).success).toBe(true)
    expect(findYieldInputSchema.safeParse({}).success).toBe(false)
  })

  it('returns opportunities for unknown token with default multiplier', async () => {
    const client = {} as ReturnType<typeof createYieldClient>
    const result = await findYield('UNKNOWN_TOKEN_XYZ', client)
    // Unknown tokens get multiplier 0.7, so all APYs should be < baseApy
    expect(result.opportunities.length).toBe(PROTOCOL_CONFIGS.length)
    result.opportunities.forEach((o) => {
      expect(o.apy).toBeGreaterThan(0)
    })
    expect(result.token).toBe('UNKNOWN_TOKEN_XYZ')
  })

  it('maintains stable sort order for protocols with equal adjusted APY', async () => {
    const client = {} as ReturnType<typeof createYieldClient>
    // Run twice with same token to verify deterministic ordering
    const result1 = await findYield('USDC', client)
    const result2 = await findYield('USDC', client)
    const names1 = result1.opportunities.map((o) => o.protocol)
    const names2 = result2.opportunities.map((o) => o.protocol)
    expect(names1).toEqual(names2)
  })

  it('all APYs are non-negative after multiplier application', async () => {
    const client = {} as ReturnType<typeof createYieldClient>
    // Test with every known token multiplier
    for (const token of Object.keys(TOKEN_MULTIPLIERS)) {
      const result = await findYield(token, client)
      result.opportunities.forEach((o) => {
        expect(o.apy).toBeGreaterThanOrEqual(0)
      })
    }
  })
})
