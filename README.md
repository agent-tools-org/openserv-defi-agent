# OpenServ DeFi Analytics Agent

> On-chain DeFi analytics as a discoverable service in the [OpenServ](https://openserv.ai/) marketplace.
> Built with the **@openserv-labs/sdk**, reading live data from **Base** via **viem**.

## Architecture

```
┌─────────────────────────────────────────────┐
│            OpenServ Platform                │
│  (Marketplace Discovery · Task Routing)     │
└──────────────────┬──────────────────────────┘
                   │  WebSocket Tunnel / HTTP
                   ▼
┌─────────────────────────────────────────────┐
│         DeFi Analytics Agent                │
│  (OpenServ SDK · System Prompt · Router)    │
├─────────────┬──────────────┬────────────────┤
│ Pool        │ Token        │ Yield          │
│ Analyzer    │ Scanner      │ Finder         │
│ ─────────── │ ──────────── │ ────────────── │
│ Uniswap V3  │ ERC-20 data  │ Aave, Compound │
│ slot0, liq   │ proxy detect │ Moonwell, etc. │
└──────┬──────┴──────┬───────┴───────┬────────┘
       │             │               │
       ▼             ▼               ▼
┌─────────────────────────────────────────────┐
│         Base L2 (On-chain Data)             │
│   via viem Public Client + JSON-RPC         │
└─────────────────────────────────────────────┘
```

## Capabilities

| Capability | Description |
|---|---|
| **analyze_pool** | Analyze a Uniswap V3 pool — token pair, price, liquidity, fee tier, tick, volume estimate |
| **scan_token** | Scan an ERC-20 token — name, symbol, supply, and pattern detection (proxy, mintable, pausable) |
| **find_yield** | Discover top yield opportunities across DeFi protocols sorted by APY |

### analyze_pool

Reads on-chain state from any Uniswap V3 pool on Base. Fetches `slot0`, `liquidity`, and token metadata in a single multicall. Returns the current mid-price computed from `sqrtPriceX96`, the active tick, fee tier, and a 24-hour volume estimate derived from liquidity depth and fee rate.

**Example request:**
```json
{ "poolAddress": "0xd0b53D9277642d899DF5C87A3966A349A798F224" }
```

**Example response:**
```
## Pool Analysis: WETH/USDC
- Fee Tier: 0.05%
- Current Price: 3421.87 USDC per WETH
- Liquidity: 5000000000000000000
- Tick: 201234
- 24h Volume (est.): $12.00
```

### scan_token

Inspects any ERC-20 token contract on Base. Returns standard metadata (name, symbol, decimals, total supply) and runs pattern detection: checks EIP-1967 proxy storage slots, probes for `mint()` and `pause()` selectors via static `call`.

**Example request:**
```json
{ "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" }
```

**Example response:**
```
## Token Scan: USD Coin (USDC)
- Decimals: 6
- Total Supply: 26000000
- Patterns: Proxy, Pausable
```

### find_yield

Discovers yield opportunities for a given token across five lending protocols on Base: Aave V3, Compound V3, Moonwell, Seamless, and Extra Finance. APYs are adjusted per token using known multipliers. Results are sorted by APY descending with risk ratings (low / medium / high).

**Example request:**
```json
{ "token": "WETH" }
```

**Example response:**
```
## Yield Opportunities for WETH
1. Extra Finance (Base Leveraged Yield) — APY: 10.54% | TVL: $18M | Risk: high
2. Seamless (Base ILM) — APY: 5.78% | TVL: $42M | Risk: medium
3. Moonwell (Base Lending) — APY: 4.68% | TVL: $95M | Risk: medium
4. Compound V3 (Base USDC Market) — APY: 3.49% | TVL: $182M | Risk: low
5. Aave V3 (Base Main Market) — APY: 2.72% | TVL: $245M | Risk: low
```

## OpenServ Marketplace

This agent is designed as a **discoverable service** on the OpenServ platform:

1. Other agents and users can find it through the marketplace
2. Tasks are routed to the appropriate capability automatically
3. The agent's shadow agents handle decision-making and validation
4. Structured responses are formatted for human consumption

### Integrating with Other Agents

Other agents on the OpenServ platform can call this agent's capabilities programmatically:

1. **Discover** — Find the agent by name or capability in the marketplace search.
2. **Route** — Send a task to the agent via the OpenServ task routing API.
3. **Consume** — Parse the structured Markdown response in your own agent logic.

```bash
# Example: route a task to this agent via the OpenServ API
curl -X POST https://api.openserv.ai/tasks \
  -H "Authorization: Bearer $OPENSERV_API_KEY" \
  -d '{"agent": "DeFi Analytics Agent", "capability": "analyze_pool", "args": {"poolAddress": "0xd0b53..."}}'
```

### MCP Compatibility

The agent's capabilities can be exposed as MCP (Model Context Protocol) tools, allowing integration with any MCP-compatible client. The OpenServ SDK handles the protocol layer.

## Setup

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Set your OpenServ API key
# Get one at https://platform.openserv.ai → Developer → Your Agents → Create Secret Key
```

### Environment Variables

| Variable | Required | Default |
|---|---|---|
| `OPENSERV_API_KEY` | Yes | — |
| `BASE_RPC_URL` | No | `https://mainnet.base.org` |

## Usage

### Run the Agent

```bash
# Start the agent server (connects to OpenServ via tunnel)
npm start
```

### Run the Demo

```bash
# Call each capability with real Base mainnet data
npm run demo

# Results saved to proof/demo.json
```

### Run Tests

```bash
npm test
```

## Agent Registration

1. Go to [OpenServ Platform](https://platform.openserv.ai/)
2. Navigate to **Developer → Add Agent**
3. Fill in:
   - **Name:** DeFi Analytics Agent
   - **Description:** On-chain DeFi analytics — pool analysis, token scanning, yield finding on Base
   - **Capabilities:** analyze_pool, scan_token, find_yield
4. Create a Secret Key and add it to your `.env`
5. Start the agent with `npm start`

## Development

```bash
# Type-check
npm run build

# Run tests
npm test
```

## Tech Stack

- **@openserv-labs/sdk** — Agent framework and platform integration
- **viem** — Type-safe Ethereum client for Base RPC reads
- **zod** — Input validation schemas
- **vitest** — Testing framework

## License

MIT
