import { describe, it, expect, vi } from 'vitest'

// Mock the SDK module
vi.mock('@openserv-labs/sdk', () => {
  const capabilities: Array<{ name: string; description: string; run?: Function }> = []

  return {
    Agent: vi.fn().mockImplementation(({ systemPrompt }: { systemPrompt: string }) => ({
      systemPrompt,
      capabilities,
      addCapability: vi.fn((cap: { name: string; description: string; run?: Function }) => {
        capabilities.push(cap)
      }),
      start: vi.fn()
    }))
  }
})

// Mock viem so capability imports don't fail
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

import { createDefiAgent, SYSTEM_PROMPT } from '../src/agent/defi-agent.js'

describe('defi-agent', () => {
  it('creates an agent with a DeFi system prompt', () => {
    const agent = createDefiAgent('test-key')
    expect(agent.systemPrompt).toContain('DeFi')
  })

  it('registers exactly 3 capabilities', () => {
    // Reset mock state
    vi.clearAllMocks()
    const agent = createDefiAgent('test-key')
    expect(agent.addCapability).toHaveBeenCalledTimes(3)
  })

  it('registers capabilities with correct names', () => {
    vi.clearAllMocks()
    const agent = createDefiAgent('test-key')

    const calls = (agent.addCapability as ReturnType<typeof vi.fn>).mock.calls
    const names = calls.map((c: unknown[]) => (c[0] as { name: string }).name)

    expect(names).toContain('analyze_pool')
    expect(names).toContain('scan_token')
    expect(names).toContain('find_yield')
  })

  it('system prompt mentions all three capability areas', () => {
    expect(SYSTEM_PROMPT).toContain('Pool Analysis')
    expect(SYSTEM_PROMPT).toContain('Token Scanning')
    expect(SYSTEM_PROMPT).toContain('Yield Finding')
  })
})
