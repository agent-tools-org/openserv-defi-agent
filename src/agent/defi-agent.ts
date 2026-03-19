import { Agent } from '@openserv-labs/sdk'
import { config } from '../config.js'
import { analyzePool, analyzePoolInputSchema } from '../capabilities/pool-analyzer.js'
import { scanToken, scanTokenInputSchema } from '../capabilities/token-scanner.js'
import { findYield, findYieldInputSchema } from '../capabilities/yield-finder.js'

const SYSTEM_PROMPT = `You are a DeFi analytics agent running on the OpenServ platform.
You specialize in on-chain analysis on Base (Ethereum L2).

Your capabilities:
1. **Pool Analysis** — Analyze Uniswap V3 pools: token pairs, price, liquidity, fees, volume estimates.
2. **Token Scanning** — Scan ERC-20 tokens: metadata, supply, and detect patterns (proxy, mintable, pausable).
3. **Yield Finding** — Discover top yield opportunities across DeFi protocols (Aave, Compound, Moonwell, etc.).

Always return structured, actionable data. When presenting results, highlight key metrics and risk factors.
Do not provide financial advice — present data and let users make their own decisions.`

export function createDefiAgent(apiKey?: string): Agent {
  const agent = new Agent({
    systemPrompt: SYSTEM_PROMPT,
    apiKey: apiKey ?? config.openservApiKey
  })

  agent.addCapability({
    name: 'analyze_pool',
    description:
      'Analyze a Uniswap V3 liquidity pool on Base. Returns token pair, current price, ' +
      'liquidity depth, fee tier, tick, and 24h volume estimate.',
    inputSchema: analyzePoolInputSchema,
    async run({ args }) {
      const result = await analyzePool(args.poolAddress)
      return formatPoolResult(result)
    }
  })

  agent.addCapability({
    name: 'scan_token',
    description:
      'Scan an ERC-20 token on Base. Returns name, symbol, decimals, total supply, ' +
      'and detects common patterns like proxy, mintable, and pausable.',
    inputSchema: scanTokenInputSchema,
    async run({ args }) {
      const result = await scanToken(args.address)
      return formatTokenResult(result)
    }
  })

  agent.addCapability({
    name: 'find_yield',
    description:
      'Find the best yield opportunities for a token on Base. Searches across Aave, ' +
      'Compound, Moonwell, Seamless, and Extra Finance. Returns opportunities sorted by APY.',
    inputSchema: findYieldInputSchema,
    async run({ args }) {
      const result = await findYield(args.token)
      return formatYieldResult(result)
    }
  })

  return agent
}

function formatPoolResult(r: Awaited<ReturnType<typeof analyzePool>>): string {
  return [
    `## Pool Analysis: ${r.token0.symbol}/${r.token1.symbol}`,
    `- **Address:** ${r.poolAddress}`,
    `- **Fee Tier:** ${r.fee / 10000}%`,
    `- **Current Price:** ${r.price} ${r.token1.symbol} per ${r.token0.symbol}`,
    `- **Liquidity:** ${r.liquidity}`,
    `- **Tick:** ${r.tick}`,
    `- **24h Volume (est.):** $${r.volume24hEstimate}`
  ].join('\n')
}

function formatTokenResult(r: Awaited<ReturnType<typeof scanToken>>): string {
  const flags = []
  if (r.patterns.isProxy) flags.push('Proxy')
  if (r.patterns.isMintable) flags.push('Mintable')
  if (r.patterns.isPausable) flags.push('Pausable')

  return [
    `## Token Scan: ${r.name} (${r.symbol})`,
    `- **Address:** ${r.address}`,
    `- **Decimals:** ${r.decimals}`,
    `- **Total Supply:** ${r.totalSupplyFormatted}`,
    `- **Patterns:** ${flags.length ? flags.join(', ') : 'None detected'}`
  ].join('\n')
}

function formatYieldResult(r: Awaited<ReturnType<typeof findYield>>): string {
  const header = `## Yield Opportunities for ${r.token}\n`
  const rows = r.opportunities.map(
    (o, i) =>
      `${i + 1}. **${o.protocol}** (${o.pool}) — APY: ${o.apy}% | TVL: ${o.tvl} | Risk: ${o.risk}`
  )
  return header + rows.join('\n')
}

export { SYSTEM_PROMPT }
