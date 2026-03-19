import { describe, it, expect, vi } from 'vitest'

vi.mock('viem', async () => {
  const actual = await vi.importActual('viem')
  return {
    ...actual as object,
    createPublicClient: vi.fn(() => ({
      readContract: vi.fn(),
      getStorageAt: vi.fn(),
      call: vi.fn()
    })),
    http: vi.fn()
  }
})

import { scanToken, createTokenClient, scanTokenInputSchema } from '../src/capabilities/token-scanner.js'

function makeMockTokenClient(opts: {
  name?: string
  symbol?: string
  decimals?: number
  totalSupply?: bigint
  proxySlotValue?: string
  callSuccess?: boolean
} = {}) {
  const {
    name = 'USD Coin',
    symbol = 'USDC',
    decimals = 6,
    totalSupply = BigInt('26000000000000'),
    proxySlotValue = '0x0000000000000000000000000000000000000000000000000000000000000000',
    callSuccess = false
  } = opts

  return {
    readContract: vi.fn().mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === 'name') return Promise.resolve(name)
      if (functionName === 'symbol') return Promise.resolve(symbol)
      if (functionName === 'decimals') return Promise.resolve(decimals)
      if (functionName === 'totalSupply') return Promise.resolve(totalSupply)
      return Promise.reject(new Error(`Unknown: ${functionName}`))
    }),
    getStorageAt: vi.fn().mockResolvedValue(proxySlotValue),
    call: callSuccess
      ? vi.fn().mockResolvedValue({ data: '0x' })
      : vi.fn().mockRejectedValue(new Error('revert'))
  } as unknown as ReturnType<typeof createTokenClient>
}

describe('token-scanner', () => {
  it('returns correct ERC-20 metadata', async () => {
    const client = makeMockTokenClient()
    const result = await scanToken('0xUSDC', client)

    expect(result.name).toBe('USD Coin')
    expect(result.symbol).toBe('USDC')
    expect(result.decimals).toBe(6)
    expect(result.address).toBe('0xUSDC')
  })

  it('formats total supply with correct decimals', async () => {
    const client = makeMockTokenClient({ totalSupply: BigInt('1000000000'), decimals: 6 })
    const result = await scanToken('0xToken', client)
    expect(result.totalSupplyFormatted).toBe('1000')
  })

  it('detects proxy pattern when storage slot is non-zero', async () => {
    const client = makeMockTokenClient({
      proxySlotValue: '0x000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd'
    })
    const result = await scanToken('0xProxy', client)
    expect(result.patterns.isProxy).toBe(true)
  })

  it('detects non-proxy when storage slots are zero', async () => {
    const client = makeMockTokenClient()
    const result = await scanToken('0xNormal', client)
    expect(result.patterns.isProxy).toBe(false)
  })

  it('validates input schema', () => {
    expect(scanTokenInputSchema.safeParse({ address: '0xabc' }).success).toBe(true)
    expect(scanTokenInputSchema.safeParse({}).success).toBe(false)
  })

  it('detects proxy via second storage slot (beacon)', async () => {
    const client = makeMockTokenClient()
    // Override getStorageAt to return non-zero only on second call (beacon slot)
    let callCount = 0
    client.getStorageAt = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) return Promise.resolve('0x0000000000000000000000000000000000000000000000000000000000000000')
      return Promise.resolve('0x000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd')
    })
    const result = await scanToken('0xBeaconProxy', client)
    expect(result.patterns.isProxy).toBe(true)
  })

  it('detects pausable token when pause selector succeeds', async () => {
    const client = makeMockTokenClient({ callSuccess: true })
    const result = await scanToken('0xPausable', client)
    expect(result.patterns.isPausable).toBe(true)
  })

  it('handles zero-supply token correctly', async () => {
    const client = makeMockTokenClient({ totalSupply: BigInt(0), decimals: 18 })
    const result = await scanToken('0xZeroSupply', client)
    expect(result.totalSupply).toBe('0')
    expect(result.totalSupplyFormatted).toBe('0')
  })
})
