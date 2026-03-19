import { createPublicClient, http, type Address, formatUnits } from 'viem'
import { base } from 'viem/chains'
import { z } from 'zod'
import { config } from '../config.js'

export const scanTokenInputSchema = z.object({
  address: z.string().describe('ERC-20 token contract address on Base')
})

export type TokenScanResult = {
  address: string
  name: string
  symbol: string
  decimals: number
  totalSupply: string
  totalSupplyFormatted: string
  patterns: TokenPatterns
}

export type TokenPatterns = {
  isProxy: boolean
  isMintable: boolean
  isPausable: boolean
}

const ERC20_ABI = [
  { inputs: [], name: 'name', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalSupply', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }
] as const

const PROXY_SLOTS = [
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc', // EIP-1967 impl
  '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50'  // EIP-1967 beacon
] as const

const MINTABLE_SELECTORS = ['0x40c10f19', '0xa0712d68'] as const // mint(address,uint256), mint(uint256)
const PAUSABLE_SELECTORS = ['0x8456cb59', '0x3f4ba83a'] as const // pause(), unpause()

export function createTokenClient(rpcUrl?: string) {
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl ?? config.baseRpcUrl)
  })
}

export async function scanToken(
  tokenAddress: string,
  client?: ReturnType<typeof createTokenClient>
): Promise<TokenScanResult> {
  const viem = client ?? createTokenClient()
  const addr = tokenAddress as Address

  const [name, symbol, decimals, totalSupply] = await Promise.all([
    viem.readContract({ address: addr, abi: ERC20_ABI, functionName: 'name' }),
    viem.readContract({ address: addr, abi: ERC20_ABI, functionName: 'symbol' }),
    viem.readContract({ address: addr, abi: ERC20_ABI, functionName: 'decimals' }),
    viem.readContract({ address: addr, abi: ERC20_ABI, functionName: 'totalSupply' })
  ])

  const patterns = await detectPatterns(viem, addr)

  return {
    address: tokenAddress,
    name,
    symbol,
    decimals,
    totalSupply: totalSupply.toString(),
    totalSupplyFormatted: formatUnits(totalSupply, decimals),
    patterns
  }
}

async function detectPatterns(
  client: ReturnType<typeof createTokenClient>,
  address: Address
): Promise<TokenPatterns> {
  const [isProxy, isMintable, isPausable] = await Promise.all([
    checkProxy(client, address),
    checkSelectors(client, address, MINTABLE_SELECTORS),
    checkSelectors(client, address, PAUSABLE_SELECTORS)
  ])
  return { isProxy, isMintable, isPausable }
}

async function checkProxy(
  client: ReturnType<typeof createTokenClient>,
  address: Address
): Promise<boolean> {
  for (const slot of PROXY_SLOTS) {
    try {
      const val = await client.getStorageAt({ address, slot: slot as `0x${string}` })
      if (val && val !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        return true
      }
    } catch {
      continue
    }
  }
  return false
}

async function checkSelectors(
  client: ReturnType<typeof createTokenClient>,
  address: Address,
  selectors: readonly string[]
): Promise<boolean> {
  for (const sel of selectors) {
    try {
      await client.call({ to: address, data: sel as `0x${string}` })
      return true
    } catch {
      continue
    }
  }
  return false
}
