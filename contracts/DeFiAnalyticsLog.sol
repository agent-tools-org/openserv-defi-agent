// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DeFiAnalyticsLog
/// @notice On-chain log for DeFi analytics results from the OpenServ agent.
contract DeFiAnalyticsLog {
    struct AnalyticsResult {
        address agent;
        string capability;
        string target;
        bytes32 resultHash;
        uint256 timestamp;
    }

    AnalyticsResult[] private results;

    event AnalyticsLogged(
        address indexed agent,
        string capability,
        string target,
        bytes32 resultHash
    );

    /// @notice Log an analytics result on-chain.
    /// @param capability The capability that produced the result (e.g. "analyze_pool").
    /// @param target The target of the analysis (e.g. a pool or token address).
    /// @param resultHash A keccak-256 hash of the full analytics result payload.
    function logAnalytics(
        string calldata capability,
        string calldata target,
        bytes32 resultHash
    ) external {
        results.push(
            AnalyticsResult({
                agent: msg.sender,
                capability: capability,
                target: target,
                resultHash: resultHash,
                timestamp: block.timestamp
            })
        );
        emit AnalyticsLogged(msg.sender, capability, target, resultHash);
    }

    /// @notice Return the total number of logged results.
    function getResultCount() external view returns (uint256) {
        return results.length;
    }

    /// @notice Return a specific analytics result by index.
    /// @param index The zero-based index of the result.
    function getResult(uint256 index) external view returns (AnalyticsResult memory) {
        require(index < results.length, "Index out of bounds");
        return results[index];
    }
}
