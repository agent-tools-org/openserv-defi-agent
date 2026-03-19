import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileSources, type CompileOutput } from '../src/compile.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const contractsDir = join(__dirname, '..', 'contracts')

function getArtifact(): CompileOutput {
  const source = readFileSync(join(contractsDir, 'DeFiAnalyticsLog.sol'), 'utf-8')
  const artifacts = compileSources([{ name: 'DeFiAnalyticsLog.sol', content: source }])
  const artifact = artifacts.find((a) => a.contractName === 'DeFiAnalyticsLog')
  if (!artifact) throw new Error('Contract not found')
  return artifact
}

describe('compile', () => {
  it('compiles DeFiAnalyticsLog.sol and produces a valid ABI', () => {
    const artifact = getArtifact()
    expect(Array.isArray(artifact.abi)).toBe(true)
    expect(artifact.abi.length).toBeGreaterThan(0)
  })

  it('ABI contains logAnalytics, getResultCount, and getResult functions', () => {
    const artifact = getArtifact()
    const fnNames = (artifact.abi as Array<{ type: string; name?: string }>)
      .filter((e) => e.type === 'function')
      .map((e) => e.name)

    expect(fnNames).toContain('logAnalytics')
    expect(fnNames).toContain('getResultCount')
    expect(fnNames).toContain('getResult')
  })

  it('ABI contains the AnalyticsLogged event', () => {
    const artifact = getArtifact()
    const eventNames = (artifact.abi as Array<{ type: string; name?: string }>)
      .filter((e) => e.type === 'event')
      .map((e) => e.name)

    expect(eventNames).toContain('AnalyticsLogged')
  })

  it('produces non-empty bytecode', () => {
    const artifact = getArtifact()
    expect(artifact.bytecode).toMatch(/^0x[0-9a-fA-F]+$/)
    expect(artifact.bytecode.length).toBeGreaterThan(2)
  })

  it('throws on invalid Solidity source', () => {
    expect(() =>
      compileSources([{ name: 'Bad.sol', content: 'this is not valid solidity' }])
    ).toThrow('Solidity compilation failed')
  })
})
