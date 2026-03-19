import { describe, it, expect } from 'vitest'
import { config } from '../src/config.js'

describe('config', () => {
  it('exports agent metadata with name, description, and version', () => {
    expect(config.agent.name).toBe('DeFi Analytics Agent')
    expect(config.agent.description).toContain('DeFi')
    expect(config.agent.version).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('provides a default Base RPC URL', () => {
    expect(config.baseRpcUrl).toBe('https://mainnet.base.org')
  })

  it('exports openservApiKey as a string', () => {
    expect(typeof config.openservApiKey).toBe('string')
  })
})
