// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title ERC8004Registry
 * @dev Implementation of ERC-8004 Trustless Agents standard
 * Provides Identity, Reputation, and Verification registries for AI agents
 * 
 * This contract enables:
 * - Agent registration with on-chain identity
 * - Reputation tracking through interactions
 * - Capability verification by trusted parties
 */
contract ERC8004Registry is Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============================================
    // IDENTITY REGISTRY
    // ============================================
    
    struct AgentIdentity {
        address owner;           // Owner wallet address
        string metadataUri;      // IPFS/HTTP URI to agent metadata JSON
        string agentType;        // "ai", "mcp", "sdk", "autonomous"
        uint256 registeredAt;    // Registration timestamp
        bool isActive;           // Whether agent is active
    }
    
    // agentId => AgentIdentity
    mapping(bytes32 => AgentIdentity) public agents;
    
    // owner => agentIds[]
    mapping(address => bytes32[]) public ownerAgents;
    
    // Total registered agents
    uint256 public totalAgents;
    
    // ============================================
    // REPUTATION REGISTRY
    // ============================================
    
    struct ReputationData {
        uint256 totalInteractions;
        uint256 successfulInteractions;
        uint256 totalWeight;
        uint256 successWeight;
        uint256 lastInteractionAt;
        int256 score;  // Can be negative for bad actors
    }
    
    // agentId => ReputationData
    mapping(bytes32 => ReputationData) public reputations;
    
    // Interaction record
    struct Interaction {
        bytes32 fromAgent;
        bytes32 toAgent;
        bool success;
        uint256 weight;
        uint256 timestamp;
        string interactionType;  // "purchase", "collaboration", "service"
    }
    
    // agentId => interactions[]
    mapping(bytes32 => Interaction[]) public agentInteractions;
    
    // ============================================
    // VERIFICATION REGISTRY
    // ============================================
    
    struct Verification {
        address verifier;        // Who verified this capability
        bytes32 claim;           // Capability claim hash
        string claimUri;         // URI to claim details
        uint256 verifiedAt;
        uint256 expiresAt;
        bool isValid;
    }
    
    // agentId => claim => Verification
    mapping(bytes32 => mapping(bytes32 => Verification)) public verifications;
    
    // agentId => claims[]
    mapping(bytes32 => bytes32[]) public agentClaims;
    
    // Trusted verifiers
    mapping(address => bool) public trustedVerifiers;
    
    // ============================================
    // EVENTS
    // ============================================
    
    event AgentRegistered(
        bytes32 indexed agentId,
        address indexed owner,
        string agentType,
        string metadataUri
    );
    
    event AgentUpdated(
        bytes32 indexed agentId,
        string metadataUri
    );
    
    event AgentDeactivated(
        bytes32 indexed agentId
    );
    
    event InteractionRecorded(
        bytes32 indexed fromAgent,
        bytes32 indexed toAgent,
        bool success,
        uint256 weight,
        string interactionType
    );
    
    event CapabilityVerified(
        bytes32 indexed agentId,
        bytes32 indexed claim,
        address indexed verifier,
        uint256 expiresAt
    );
    
    event CapabilityRevoked(
        bytes32 indexed agentId,
        bytes32 indexed claim
    );
    
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);
    
    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    constructor() Ownable(msg.sender) {
        // Owner is automatically a trusted verifier
        trustedVerifiers[msg.sender] = true;
    }
    
    // ============================================
    // IDENTITY FUNCTIONS
    // ============================================
    
    /**
     * @dev Register a new AI agent
     * @param agentId Unique identifier for the agent (keccak256 hash)
     * @param metadataUri URI pointing to agent metadata JSON
     * @param agentType Type of agent ("ai", "mcp", "sdk", "autonomous")
     */
    function registerAgent(
        bytes32 agentId,
        string calldata metadataUri,
        string calldata agentType
    ) external {
        require(agents[agentId].owner == address(0), "Agent already registered");
        require(bytes(metadataUri).length > 0, "Metadata URI required");
        
        agents[agentId] = AgentIdentity({
            owner: msg.sender,
            metadataUri: metadataUri,
            agentType: agentType,
            registeredAt: block.timestamp,
            isActive: true
        });
        
        ownerAgents[msg.sender].push(agentId);
        totalAgents++;
        
        // Initialize reputation
        reputations[agentId] = ReputationData({
            totalInteractions: 0,
            successfulInteractions: 0,
            totalWeight: 0,
            successWeight: 0,
            lastInteractionAt: 0,
            score: 0
        });
        
        emit AgentRegistered(agentId, msg.sender, agentType, metadataUri);
    }
    
    /**
     * @dev Register agent with signature (for gasless registration)
     */
    function registerAgentWithSignature(
        bytes32 agentId,
        string calldata metadataUri,
        string calldata agentType,
        address owner,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(block.timestamp <= deadline, "Signature expired");
        require(agents[agentId].owner == address(0), "Agent already registered");
        
        // Verify signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            agentId, metadataUri, agentType, owner, deadline, address(this)
        ));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);
        require(signer == owner, "Invalid signature");
        
        agents[agentId] = AgentIdentity({
            owner: owner,
            metadataUri: metadataUri,
            agentType: agentType,
            registeredAt: block.timestamp,
            isActive: true
        });
        
        ownerAgents[owner].push(agentId);
        totalAgents++;
        
        reputations[agentId] = ReputationData({
            totalInteractions: 0,
            successfulInteractions: 0,
            totalWeight: 0,
            successWeight: 0,
            lastInteractionAt: 0,
            score: 0
        });
        
        emit AgentRegistered(agentId, owner, agentType, metadataUri);
    }
    
    /**
     * @dev Update agent metadata
     */
    function updateAgentMetadata(
        bytes32 agentId,
        string calldata newMetadataUri
    ) external {
        require(agents[agentId].owner == msg.sender, "Not agent owner");
        require(agents[agentId].isActive, "Agent not active");
        
        agents[agentId].metadataUri = newMetadataUri;
        emit AgentUpdated(agentId, newMetadataUri);
    }
    
    /**
     * @dev Deactivate an agent
     */
    function deactivateAgent(bytes32 agentId) external {
        require(agents[agentId].owner == msg.sender || msg.sender == owner(), "Not authorized");
        require(agents[agentId].isActive, "Already inactive");
        
        agents[agentId].isActive = false;
        emit AgentDeactivated(agentId);
    }
    
    /**
     * @dev Get agent metadata URI
     */
    function getAgentMetadata(bytes32 agentId) external view returns (string memory) {
        return agents[agentId].metadataUri;
    }
    
    /**
     * @dev Get all agents owned by an address
     */
    function getAgentsByOwner(address owner) external view returns (bytes32[] memory) {
        return ownerAgents[owner];
    }
    
    /**
     * @dev Check if agent exists and is active
     */
    function isAgentActive(bytes32 agentId) external view returns (bool) {
        return agents[agentId].isActive;
    }
    
    // ============================================
    // REPUTATION FUNCTIONS
    // ============================================
    
    /**
     * @dev Record an interaction between agents
     * @param fromAgentId The initiating agent
     * @param toAgentId The receiving agent
     * @param success Whether the interaction was successful
     * @param weight Importance weight (1-100)
     * @param interactionType Type of interaction
     */
    function recordInteraction(
        bytes32 fromAgentId,
        bytes32 toAgentId,
        bool success,
        uint256 weight,
        string calldata interactionType
    ) external {
        require(agents[fromAgentId].owner == msg.sender, "Not from-agent owner");
        require(agents[toAgentId].isActive, "To-agent not active");
        require(weight > 0 && weight <= 100, "Weight must be 1-100");
        
        // Update to-agent reputation
        ReputationData storage rep = reputations[toAgentId];
        rep.totalInteractions++;
        rep.totalWeight += weight;
        rep.lastInteractionAt = block.timestamp;
        
        if (success) {
            rep.successfulInteractions++;
            rep.successWeight += weight;
            rep.score += int256(weight);
        } else {
            rep.score -= int256(weight / 2); // Failures have less impact
        }
        
        // Store interaction record
        agentInteractions[toAgentId].push(Interaction({
            fromAgent: fromAgentId,
            toAgent: toAgentId,
            success: success,
            weight: weight,
            timestamp: block.timestamp,
            interactionType: interactionType
        }));
        
        emit InteractionRecorded(fromAgentId, toAgentId, success, weight, interactionType);
    }
    
    /**
     * @dev Get agent reputation data
     */
    function getReputation(bytes32 agentId) external view returns (
        uint256 totalInteractions,
        uint256 successfulInteractions,
        uint256 successRate,
        int256 score
    ) {
        ReputationData storage rep = reputations[agentId];
        totalInteractions = rep.totalInteractions;
        successfulInteractions = rep.successfulInteractions;
        successRate = rep.totalInteractions > 0 
            ? (rep.successfulInteractions * 100) / rep.totalInteractions 
            : 0;
        score = rep.score;
    }
    
    /**
     * @dev Get top agents by reputation score
     */
    function getTopAgents(uint256 limit) external view returns (bytes32[] memory, int256[] memory) {
        // Note: This is a simplified implementation
        // In production, use off-chain indexing for efficiency
        bytes32[] memory topIds = new bytes32[](limit);
        int256[] memory topScores = new int256[](limit);
        
        // Return empty arrays - actual implementation would need indexing
        return (topIds, topScores);
    }
    
    /**
     * @dev Get interaction history for an agent
     */
    function getInteractionHistory(
        bytes32 agentId,
        uint256 offset,
        uint256 limit
    ) external view returns (Interaction[] memory) {
        Interaction[] storage allInteractions = agentInteractions[agentId];
        uint256 total = allInteractions.length;
        
        if (offset >= total) {
            return new Interaction[](0);
        }
        
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 resultLength = end - offset;
        
        Interaction[] memory result = new Interaction[](resultLength);
        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = allInteractions[offset + i];
        }
        
        return result;
    }
    
    // ============================================
    // VERIFICATION FUNCTIONS
    // ============================================
    
    /**
     * @dev Add a trusted verifier
     */
    function addVerifier(address verifier) external onlyOwner {
        trustedVerifiers[verifier] = true;
        emit VerifierAdded(verifier);
    }
    
    /**
     * @dev Remove a trusted verifier
     */
    function removeVerifier(address verifier) external onlyOwner {
        trustedVerifiers[verifier] = false;
        emit VerifierRemoved(verifier);
    }
    
    /**
     * @dev Verify an agent's capability
     * @param agentId The agent to verify
     * @param claim The capability claim hash
     * @param claimUri URI with claim details
     * @param expiresAt Expiration timestamp (0 for no expiry)
     */
    function verifyCapability(
        bytes32 agentId,
        bytes32 claim,
        string calldata claimUri,
        uint256 expiresAt
    ) external {
        require(trustedVerifiers[msg.sender], "Not a trusted verifier");
        require(agents[agentId].isActive, "Agent not active");
        require(expiresAt == 0 || expiresAt > block.timestamp, "Invalid expiry");
        
        verifications[agentId][claim] = Verification({
            verifier: msg.sender,
            claim: claim,
            claimUri: claimUri,
            verifiedAt: block.timestamp,
            expiresAt: expiresAt,
            isValid: true
        });
        
        agentClaims[agentId].push(claim);
        
        emit CapabilityVerified(agentId, claim, msg.sender, expiresAt);
    }
    
    /**
     * @dev Revoke a capability verification
     */
    function revokeCapability(bytes32 agentId, bytes32 claim) external {
        Verification storage v = verifications[agentId][claim];
        require(v.verifier == msg.sender || msg.sender == owner(), "Not authorized");
        
        v.isValid = false;
        emit CapabilityRevoked(agentId, claim);
    }
    
    /**
     * @dev Check if agent has a valid capability
     */
    function isVerified(bytes32 agentId, bytes32 claim) external view returns (bool) {
        Verification storage v = verifications[agentId][claim];
        if (!v.isValid) return false;
        if (v.expiresAt > 0 && v.expiresAt < block.timestamp) return false;
        return true;
    }
    
    /**
     * @dev Get all verifications for an agent
     */
    function getVerifications(bytes32 agentId) external view returns (bytes32[] memory) {
        return agentClaims[agentId];
    }
    
    /**
     * @dev Get verification details
     */
    function getVerificationDetails(
        bytes32 agentId,
        bytes32 claim
    ) external view returns (
        address verifier,
        string memory claimUri,
        uint256 verifiedAt,
        uint256 expiresAt,
        bool isValid
    ) {
        Verification storage v = verifications[agentId][claim];
        return (v.verifier, v.claimUri, v.verifiedAt, v.expiresAt, v.isValid);
    }
    
    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    
    /**
     * @dev Generate agent ID from name and owner
     */
    function generateAgentId(
        string calldata agentName,
        address owner
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(agentName, owner));
    }
    
    /**
     * @dev Generate claim hash from capability string
     */
    function generateClaimHash(string calldata capability) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(capability));
    }
}
