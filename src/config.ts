import 'dotenv/config'

export const config = {
  openservApiKey: process.env.OPENSERV_API_KEY ?? '',
  baseRpcUrl: process.env.BASE_RPC_URL ?? 'https://mainnet.base.org',
  agent: {
    name: 'DeFi Analytics Agent',
    description:
      'On-chain DeFi analytics agent for the OpenServ marketplace. ' +
      'Analyzes Uniswap V3 pools, scans ERC-20 tokens, and discovers yield opportunities on Base.',
    version: '1.0.0'
  }
} as const
