# Hackathon Project Audit: openserv-defi-agent

## Summary
The **openserv-defi-agent** is a TypeScript-based agent for the OpenServ marketplace, designed to provide on-chain DeFi analytics on the Base network. While the project is well-structured and passes its current unit tests, the audit identified several critical and high-severity issues. The most significant finding is that the "Yield Finding" capability relies on hardcoded data, and the included Solidity contract is not integrated into the agent's logic. Additionally, there are precision issues in price calculations and flawed contract pattern detection.

## Critical Findings

### 1. Hardcoded Yield Data in `yield-finder.ts`
**File:** `src/capabilities/yield-finder.ts` (Lines 22-55, 107-128)
The agent claims to provide on-chain analytics, but the `find_yield` capability uses hardcoded base APYs and TVL estimates for protocols like Aave, Compound, and Moonwell. These values are adjusted by a static multiplier per token.
- **Impact:** The data is static and will quickly become inaccurate, rendering the capability useless for real-time DeFi analysis.
- **Recommendation:** Integrate with on-chain rate providers or indexers (e.g., Aave V3 data provider) to fetch live APY and TVL data.

### 2. `DeFiAnalyticsLog.sol` Not Integrated
**File:** Entire project
The project includes a Solidity contract (`contracts/DeFiAnalyticsLog.sol`) intended for logging analytics results on-chain. However, this contract is only used in the compilation script and its own unit tests. No agent capability actually calls this contract to log results.
- **Impact:** A core feature (on-chain logging) is implemented but not used.
- **Recommendation:** Implement a step in each capability's `run` function to log the `resultHash` to the `DeFiAnalyticsLog` contract using a `walletClient` in `viem`.

## High Findings

### 1. Precision Loss in `computePrice`
**File:** `src/capabilities/pool-analyzer.ts:81`
The `computePrice` function converts `sqrtPriceX96` (a `uint160`) to a JavaScript `Number` before division.
- **Impact:** `Number` can only represent integers precisely up to \(2^{53}-1\). Since `sqrtPriceX96` is often near \(2^{96}\) or higher, this leads to significant precision loss, making price reports inaccurate for Uniswap V3 pools.
- **Recommendation:** Use `bigint` for calculations where possible, or use a high-precision decimal library.

### 2. Flawed Pattern Detection in `token-scanner.ts`
**File:** `src/capabilities/token-scanner.ts:100`
The `checkSelectors` function probes for `mint` and `pause` functions by sending only the 4-byte selector via `client.call`.
- **Impact:** Functions like `mint(address,uint256)` expect arguments and will likely revert if called with only 4 bytes of data. Since the code interprets *any* revert as the function being missing, it will incorrectly report many tokens as not mintable or not pausable.
- **Recommendation:** Append dummy arguments (e.g., zero address and zero amount) to the selector to avoid reverts caused by data length mismatches.

## Medium Findings

### 1. Lack of Access Control in `DeFiAnalyticsLog.sol`
**File:** `contracts/DeFiAnalyticsLog.sol:26`
The `logAnalytics` function is `external` and has no access control.
- **Impact:** Anyone can call this function and log results appearing as if they came from a legitimate agent. This compromises the integrity of the on-chain log.
- **Recommendation:** Add an `owner` or `authorizedAgents` mapping and use a modifier to restrict `logAnalytics`.

### 2. Production Deployment Method
**File:** `src/index.ts:16`
The agent uses `agent.start()` to launch the server.
- **Impact:** As noted in the source comments, `run(agent)` is preferred for production to enable OpenServ's tunnel support. `agent.start()` is limited to a simple local HTTP server.
- **Recommendation:** Switch to `run(agent)` from `@openserv-labs/sdk` for production readiness.

## Low Findings

### 1. Inaccurate "Multicall" Claim in README
**File:** `README.md` and `src/capabilities/pool-analyzer.ts:51`
The README states that `analyze_pool` fetches data in a "single multicall". However, the implementation uses `Promise.all` with multiple `readContract` calls.
- **Impact:** This results in 5 separate JSON-RPC requests rather than 1, increasing latency and RPC costs.
- **Recommendation:** Use `viem`'s `multicall` function to truly bundle the requests.

### 2. Simplified Volume Heuristic
**File:** `src/capabilities/pool-analyzer.ts:88`
`estimateVolume` uses a very basic formula: `liquidity * feeRate * 24`.
- **Impact:** This is a very rough estimate and does not account for actual trading activity or tick ranges.
- **Recommendation:** Clearly label this as a "Heuristic Volume Estimate" in the output.

## Test Gaps
- **Integration Tests:** No tests verify the interaction between the TypeScript agent and the Solidity contract.
- **Capability Logic:** `test/defi-agent.test.ts` only tests capability registration. The actual `run` logic (formatting and coordination) is untested at the agent level.
- **Network Resilience:** No tests simulate RPC failures or timeouts, which are common in on-chain agents.
