import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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
  TOKEN_MULTIPLIERS,
  parseDefillamaPoolsResponse,
  formatTvl
} from '../src/capabilities/yield-finder.js'

describe('yield-finder', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns live data with dataSource "live" when DefiLlama fetch succeeds', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { chain: 'Base', project: 'aave-v3', symbol: 'USDC', apy: 5.2, tvlUsd: 250000000 },
          { chain: 'Base', project: 'compound-v3', symbol: 'USDC', apy: 4.8, tvlUsd: 180000000 }
        ]
      })
    })

    const client = {} as ReturnType<typeof createYieldClient>
    const result = await findYield('USDC', client)

    expect(result.dataSource).toBe('live')
    expect(result.opportunities.length).toBeGreaterThan(0)
    expect(result.opportunities.every((o) => o.dataSource === 'live')).toBe(true)
    expect(global.fetch).toHaveBeenCalledWith('https://yields.llama.fi/pools')
  })

  it('returns demo data with dataSource "cached" when DefiLlama fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

    const client = {} as ReturnType<typeof createYieldClient>
    const result = await findYield('USDC', client)

    expect(result.dataSource).toBe('cached')
    expect(result.opportunities.length).toBe(PROTOCOL_CONFIGS.length)
    expect(result.opportunities.every((o) => o.dataSource === 'cached')).toBe(true)
  })

  it('returns demo data with dataSource "cached" when DefiLlama returns no matching pools', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] })
    })

    const client = {} as ReturnType<typeof createYieldClient>
    const result = await findYield('USDC', client)

    expect(result.dataSource).toBe('cached')
    expect(result.opportunities.every((o) => o.dataSource === 'cached')).toBe(true)
  })

  it('returns opportunities sorted by APY descending', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Force demo'))

    const client = {} as ReturnType<typeof createYieldClient>
    const result = await findYield('WETH', client)

    for (let i = 1; i < result.opportunities.length; i++) {
      expect(result.opportunities[i - 1].apy).toBeGreaterThanOrEqual(result.opportunities[i].apy)
    }
  })

  it('returns all known protocols', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Force demo'))

    const client = {} as ReturnType<typeof createYieldClient>
    const result = await findYield('USDC', client)
    expect(result.opportunities.length).toBeGreaterThanOrEqual(1)

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
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Force demo'))

    const client = {} as ReturnType<typeof createYieldClient>

    const wethResult = await findYield('WETH', client)
    const usdcResult = await findYield('USDC', client)

    // WETH multiplier is 0.85, USDC is 1.0, so USDC APYs should be higher
    const wethMax = Math.max(...wethResult.opportunities.map((o) => o.apy))
    const usdcMax = Math.max(...usdcResult.opportunities.map((o) => o.apy))
    expect(usdcMax).toBeGreaterThan(wethMax)
  })

  it('includes timestamp in result', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Force demo'))

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
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Force demo'))

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
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Force demo'))

    const client = {} as ReturnType<typeof createYieldClient>
    // Run twice with same token to verify deterministic ordering
    const result1 = await findYield('USDC', client)
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Force demo'))
    const result2 = await findYield('USDC', client)
    const names1 = result1.opportunities.map((o) => o.protocol)
    const names2 = result2.opportunities.map((o) => o.protocol)
    expect(names1).toEqual(names2)
  })

  it('all APYs are non-negative after multiplier application', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Force demo'))

    const client = {} as ReturnType<typeof createYieldClient>
    // Test with every known token multiplier
    for (const token of Object.keys(TOKEN_MULTIPLIERS)) {
      const result = await findYield(token, client)
      result.opportunities.forEach((o) => {
        expect(o.apy).toBeGreaterThanOrEqual(0)
      })
    }
  })

  it('falls back to cached when DefiLlama payload parsing fails', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ chain: 'Base', project: 'aave-v3', symbol: 'USDC', apy: '5.2' }] })
    })

    const client = {} as ReturnType<typeof createYieldClient>
    const result = await findYield('USDC', client)
    expect(result.dataSource).toBe('cached')
  })

  it('parseDefillamaPoolsResponse accepts a valid payload', () => {
    const parsed = parseDefillamaPoolsResponse({
      data: [{ chain: 'Base', project: 'aave-v3', symbol: 'USDC', apy: 5.2, tvlUsd: 123 }]
    })
    expect(parsed.data.length).toBe(1)
    expect(parsed.data[0].project).toBe('aave-v3')
  })

  it('parseDefillamaPoolsResponse throws on invalid payload', () => {
    expect(() => parseDefillamaPoolsResponse({ data: [{ chain: 'Base' }] })).toThrow()
  })

  it('formatTvl formats magnitudes consistently', () => {
    expect(formatTvl(999)).toBe('$999')
    expect(formatTvl(12_345)).toBe('$12.3K')
    expect(formatTvl(1_234_567)).toBe('$1.2M')
    expect(formatTvl(2_345_678_901)).toBe('$2.35B')
  })
})
