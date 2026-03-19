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

## OpenServ Marketplace

This agent is designed as a **discoverable service** on the OpenServ platform:

1. Other agents and users can find it through the marketplace
2. Tasks are routed to the appropriate capability automatically
3. The agent's shadow agents handle decision-making and validation
4. Structured responses are formatted for human consumption

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
