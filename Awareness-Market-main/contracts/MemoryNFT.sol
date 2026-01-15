// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MemoryNFT
 * @dev ERC-721 NFT representing LatentMAS Memory ownership
 * Each NFT can have a Token Bound Account (ERC-6551) for autonomous asset management
 */
contract MemoryNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    
    // Mapping from token ID to memory metadata
    mapping(uint256 => MemoryMetadata) public memoryMetadata;
    
    // Mapping from token ID to TBA address
    mapping(uint256 => address) public tokenBoundAccounts;
    
    struct MemoryMetadata {
        string memoryId;          // UUID from database
        string sourceModel;       // e.g., "gpt-3.5-turbo"
        string targetModel;       // e.g., "gpt-4"
        uint256 hiddenDim;        // Hidden state dimension
        string storageUrl;        // S3 URL to KV-Cache data
        string wMatrixChecksum;   // SHA-256 checksum
        uint256 createdAt;        // Timestamp
    }
    
    event MemoryMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string memoryId,
        string sourceModel,
        string targetModel
    );
    
    event TBACreated(
        uint256 indexed tokenId,
        address indexed tbaAddress
    );
    
    constructor() ERC721("LatentMAS Memory", "LMEM") Ownable(msg.sender) {}
    
    /**
     * @dev Mint a new Memory NFT
     * @param to The address that will own the minted NFT
     * @param memoryId The UUID from the database
     * @param sourceModel The source model name
     * @param targetModel The target model name
     * @param hiddenDim The hidden state dimension
     * @param storageUrl The S3 URL to KV-Cache data
     * @param wMatrixChecksum The SHA-256 checksum of W-Matrix
     * @param uri The token URI (metadata JSON)
     * @return tokenId The ID of the newly minted NFT
     */
    function mintMemory(
        address to,
        string memory memoryId,
        string memory sourceModel,
        string memory targetModel,
        uint256 hiddenDim,
        string memory storageUrl,
        string memory wMatrixChecksum,
        string memory uri
    ) public onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        
        memoryMetadata[tokenId] = MemoryMetadata({
            memoryId: memoryId,
            sourceModel: sourceModel,
            targetModel: targetModel,
            hiddenDim: hiddenDim,
            storageUrl: storageUrl,
            wMatrixChecksum: wMatrixChecksum,
            createdAt: block.timestamp
        });
        
        emit MemoryMinted(tokenId, to, memoryId, sourceModel, targetModel);
        
        return tokenId;
    }
    
    /**
     * @dev Register a Token Bound Account for a Memory NFT
     * @param tokenId The NFT token ID
     * @param tbaAddress The address of the created TBA
     */
    function registerTBA(uint256 tokenId, address tbaAddress) public onlyOwner {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        require(tokenBoundAccounts[tokenId] == address(0), "TBA already registered");
        
        tokenBoundAccounts[tokenId] = tbaAddress;
        emit TBACreated(tokenId, tbaAddress);
    }
    
    /**
     * @dev Get the Token Bound Account address for a token
     * @param tokenId The NFT token ID
     * @return The TBA address, or address(0) if not registered
     */
    function getTBA(uint256 tokenId) public view returns (address) {
        return tokenBoundAccounts[tokenId];
    }
    
    /**
     * @dev Get memory metadata for a token
     * @param tokenId The NFT token ID
     * @return The memory metadata struct
     */
    function getMemoryMetadata(uint256 tokenId) public view returns (MemoryMetadata memory) {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        return memoryMetadata[tokenId];
    }
    
    // The following functions are overrides required by Solidity
    
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
