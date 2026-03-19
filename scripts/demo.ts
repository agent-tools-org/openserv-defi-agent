/**
 * Demo script — calls each DeFi capability against Base mainnet.
 * Run: npm run demo
 * Output: proof/demo.json
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { analyzePool, createViemClient } from '../src/capabilities/pool-analyzer.js'
import { scanToken, createTokenClient } from '../src/capabilities/token-scanner.js'
import { findYield, createYieldClient } from '../src/capabilities/yield-finder.js'

// Well-known addresses on Base
const WETH_USDC_POOL = '0xd0b53D9277642d899DF5C87A3966A349A798F224' // Uniswap V3 WETH/USDC 0.05%
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'   // USDC on Base

async function main() {
  console.log('=== OpenServ DeFi Agent Demo ===\n')
  const results: Record<string, unknown> = { timestamp: new Date().toISOString() }

  // 1. Pool Analysis
  console.log('1. Analyzing WETH/USDC pool...')
  try {
    const poolClient = createViemClient()
    const poolResult = await analyzePool(WETH_USDC_POOL, poolClient)
    results.poolAnalysis = poolResult
    console.log(`   ✓ ${poolResult.token0.symbol}/${poolResult.token1.symbol} — Price: ${poolResult.price}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.log(`   ✗ Pool analysis failed: ${message}`)
    results.poolAnalysis = { error: message }
  }

  // 2. Token Scan
  console.log('2. Scanning USDC token...')
  try {
    const tokenClient = createTokenClient()
    const tokenResult = await scanToken(USDC_ADDRESS, tokenClient)
    results.tokenScan = tokenResult
    console.log(`   ✓ ${tokenResult.name} (${tokenResult.symbol}) — Supply: ${tokenResult.totalSupplyFormatted}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.log(`   ✗ Token scan failed: ${message}`)
    results.tokenScan = { error: message }
  }

  // 3. Yield Finder
  console.log('3. Finding yield for WETH...')
  try {
    const yieldClient = createYieldClient()
    const yieldResult = await findYield('WETH', yieldClient)
    results.yieldOpportunities = yieldResult
    console.log(`   ✓ Found ${yieldResult.opportunities.length} opportunities`)
    yieldResult.opportunities.slice(0, 3).forEach((o) => {
      console.log(`     - ${o.protocol}: ${o.apy}% APY (${o.risk} risk)`)
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.log(`   ✗ Yield finder failed: ${message}`)
    results.yieldOpportunities = { error: message }
  }

  // Write proof
  mkdirSync('proof', { recursive: true })
  writeFileSync('proof/demo.json', JSON.stringify(results, null, 2))
  console.log('\n✅ Results saved to proof/demo.json')
}

main().catch((err) => {
  console.error('Demo failed:', err)
  process.exit(1)
})
