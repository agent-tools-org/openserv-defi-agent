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
const INVALID_ADDRESS = '0x0000000000000000000000000000000000000000'  // zero address for error demo

function printTable(headers: string[], rows: string[][]): void {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length))
  )
  const sep = widths.map((w) => '-'.repeat(w + 2)).join('+')
  const fmt = (cells: string[]) =>
    cells.map((c, i) => ` ${c.padEnd(widths[i])} `).join('|')

  console.log(fmt(headers))
  console.log(sep)
  rows.forEach((r) => console.log(fmt(r)))
}

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
    console.log(`   ✓ Found ${yieldResult.opportunities.length} opportunities\n`)

    // Formatted table output for yield comparison
    const headers = ['Protocol', 'Pool', 'APY', 'TVL', 'Risk']
    const rows = yieldResult.opportunities.map((o) => [
      o.protocol,
      o.pool,
      `${o.apy}%`,
      o.tvl,
      o.risk
    ])
    printTable(headers, rows)
    console.log()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.log(`   ✗ Yield finder failed: ${message}`)
    results.yieldOpportunities = { error: message }
  }

  // 4. Error Handling Demo — invalid addresses
  console.log('4. Error handling: invalid pool address...')
  try {
    const poolClient = createViemClient()
    await analyzePool(INVALID_ADDRESS, poolClient)
    results.errorDemo = { error: 'Expected failure did not occur' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.log(`   ✓ Correctly caught error: ${message.slice(0, 80)}`)
    results.errorDemo = { handled: true, error: message }
  }

  console.log('5. Error handling: invalid token address...')
  try {
    const tokenClient = createTokenClient()
    await scanToken(INVALID_ADDRESS, tokenClient)
    results.errorDemoToken = { error: 'Expected failure did not occur' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.log(`   ✓ Correctly caught error: ${message.slice(0, 80)}`)
    results.errorDemoToken = { handled: true, error: message }
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
