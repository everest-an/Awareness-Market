// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title AMEMToken
 * @dev Awareness Memory Token ($AMEM) - The native utility token of LatentMAS protocol
 *
 * Features:
 * - ERC-20 compliant
 * - Fixed supply: 1,000,000,000 tokens
 * - Deflationary mechanism: 30% of transaction fees are burned
 * - Role-based access control
 * - Pausable for emergency situations
 * - Anti-reentrancy protection
 *
 * Token Allocation (as per whitepaper):
 * - Memory Mining: 40%
 * - Standardization Node Rewards: 20%
 * - Ecosystem & Partners: 15%
 * - Treasury: 15%
 * - Team & Early Contributors: 10%
 */
contract AMEMToken is ERC20, ERC20Burnable, AccessControl, Pausable, ReentrancyGuard {
    // Roles
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");

    // Token Economics
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens
    uint256 public constant BURN_FEE_PERCENTAGE = 30; // 30% of fees are burned
    uint256 public constant MAINTAINER_FEE_PERCENTAGE = 20; // 20% to maintainers
    uint256 public constant SELLER_FEE_PERCENTAGE = 50; // 50% to seller

    // Fee Configuration
    bool public feesEnabled = true;
    uint256 public transactionFeeRate = 100; // 1% (basis points: 100 = 1%)
    address public feeCollector;
    address public maintainerPool;

    // Statistics
    uint256 public totalBurned;
    uint256 public totalFeesCollected;

    // Events
    event FeesCollected(address indexed from, address indexed to, uint256 amount, uint256 burned);
    event FeeRateUpdated(uint256 oldRate, uint256 newRate);
    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);
    event MaintainerPoolUpdated(address indexed oldPool, address indexed newPool);
    event FeesToggled(bool enabled);

    /**
     * @dev Constructor - Initialize the token and allocate supply
     * @param _feeCollector Address to collect platform fees
     * @param _maintainerPool Address for W-Matrix maintainer rewards
     */
    constructor(
        address _feeCollector,
        address _maintainerPool
    ) ERC20("Awareness Memory Token", "AMEM") {
        require(_feeCollector != address(0), "Invalid fee collector");
        require(_maintainerPool != address(0), "Invalid maintainer pool");

        feeCollector = _feeCollector;
        maintainerPool = _maintainerPool;

        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(FEE_MANAGER_ROLE, msg.sender);

        // Mint total supply according to whitepaper allocation
        _mint(msg.sender, TOTAL_SUPPLY);
    }

    /**
     * @dev Override transfer to implement fee mechanism
     */
    function transfer(address to, uint256 amount)
        public
        virtual
        override
        whenNotPaused
        returns (bool)
    {
        address owner = _msgSender();

        if (feesEnabled && !hasRole(FEE_MANAGER_ROLE, owner)) {
            uint256 fee = _calculateFee(amount);
            uint256 amountAfterFee = amount - fee;

            // Distribute fees
            _distributeFees(owner, fee);

            // Transfer remaining amount
            _transfer(owner, to, amountAfterFee);

            return true;
        } else {
            // No fees for FEE_MANAGER_ROLE or when fees disabled
            _transfer(owner, to, amount);
            return true;
        }
    }

    /**
     * @dev Override transferFrom to implement fee mechanism
     */
    function transferFrom(address from, address to, uint256 amount)
        public
        virtual
        override
        whenNotPaused
        returns (bool)
    {
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);

        if (feesEnabled && !hasRole(FEE_MANAGER_ROLE, from)) {
            uint256 fee = _calculateFee(amount);
            uint256 amountAfterFee = amount - fee;

            // Distribute fees
            _distributeFees(from, fee);

            // Transfer remaining amount
            _transfer(from, to, amountAfterFee);

            return true;
        } else {
            _transfer(from, to, amount);
            return true;
        }
    }

    /**
     * @dev Calculate transaction fee
     * @param amount Transaction amount
     * @return Fee amount
     */
    function _calculateFee(uint256 amount) internal view returns (uint256) {
        return (amount * transactionFeeRate) / 10000; // Basis points
    }

    /**
     * @dev Distribute fees according to whitepaper specification
     * @param from Address paying the fee
     * @param fee Total fee amount
     */
    function _distributeFees(address from, uint256 fee) internal {
        // 30% burned (deflationary)
        uint256 burnAmount = (fee * BURN_FEE_PERCENTAGE) / 100;

        // 20% to W-Matrix maintainers
        uint256 maintainerAmount = (fee * MAINTAINER_FEE_PERCENTAGE) / 100;

        // Remaining to fee collector (platform)
        uint256 platformAmount = fee - burnAmount - maintainerAmount;

        // Burn tokens
        if (burnAmount > 0) {
            _burn(from, burnAmount);
            totalBurned += burnAmount;
        }

        // Transfer to maintainer pool
        if (maintainerAmount > 0) {
            _transfer(from, maintainerPool, maintainerAmount);
        }

        // Transfer to platform fee collector
        if (platformAmount > 0) {
            _transfer(from, feeCollector, platformAmount);
        }

        totalFeesCollected += fee;
        emit FeesCollected(from, feeCollector, fee, burnAmount);
    }

    /**
     * @dev Update transaction fee rate (only FEE_MANAGER_ROLE)
     * @param newRate New fee rate in basis points (100 = 1%)
     */
    function setTransactionFeeRate(uint256 newRate) external onlyRole(FEE_MANAGER_ROLE) {
        require(newRate <= 1000, "Fee rate too high"); // Max 10%

        uint256 oldRate = transactionFeeRate;
        transactionFeeRate = newRate;

        emit FeeRateUpdated(oldRate, newRate);
    }

    /**
     * @dev Update fee collector address
     * @param newCollector New fee collector address
     */
    function setFeeCollector(address newCollector) external onlyRole(FEE_MANAGER_ROLE) {
        require(newCollector != address(0), "Invalid address");

        address oldCollector = feeCollector;
        feeCollector = newCollector;

        emit FeeCollectorUpdated(oldCollector, newCollector);
    }

    /**
     * @dev Update maintainer pool address
     * @param newPool New maintainer pool address
     */
    function setMaintainerPool(address newPool) external onlyRole(FEE_MANAGER_ROLE) {
        require(newPool != address(0), "Invalid address");

        address oldPool = maintainerPool;
        maintainerPool = newPool;

        emit MaintainerPoolUpdated(oldPool, newPool);
    }

    /**
     * @dev Toggle fee collection on/off
     * @param enabled Whether fees should be enabled
     */
    function setFeesEnabled(bool enabled) external onlyRole(FEE_MANAGER_ROLE) {
        feesEnabled = enabled;
        emit FeesToggled(enabled);
    }

    /**
     * @dev Pause token transfers (emergency)
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause token transfers
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Get circulating supply (total supply - burned)
     * @return Circulating supply
     */
    function circulatingSupply() external view returns (uint256) {
        return TOTAL_SUPPLY - totalBurned;
    }

    /**
     * @dev Batch transfer to multiple recipients (gas optimization)
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to transfer
     */
    function batchTransfer(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external whenNotPaused nonReentrant returns (bool) {
        require(recipients.length == amounts.length, "Length mismatch");
        require(recipients.length <= 200, "Too many recipients");

        for (uint256 i = 0; i < recipients.length; i++) {
            transfer(recipients[i], amounts[i]);
        }

        return true;
    }

    /**
     * @dev Check if account has sufficient balance for transaction including fees
     * @param account Address to check
     * @param amount Transaction amount
     * @return Whether account has sufficient balance
     */
    function hasSufficientBalance(address account, uint256 amount)
        external
        view
        returns (bool)
    {
        if (!feesEnabled || hasRole(FEE_MANAGER_ROLE, account)) {
            return balanceOf(account) >= amount;
        } else {
            uint256 fee = _calculateFee(amount);
            return balanceOf(account) >= (amount + fee);
        }
    }

    /**
     * @dev Calculate total cost including fees
     * @param amount Base amount
     * @return Total amount needed (including fees)
     */
    function calculateTotalCost(uint256 amount) external view returns (uint256) {
        if (!feesEnabled) {
            return amount;
        }

        uint256 fee = _calculateFee(amount);
        return amount + fee;
    }

    /**
     * @dev Get token statistics
     * @return _totalSupply Total supply
     * @return _circulatingSupply Circulating supply
     * @return _totalBurned Total burned
     * @return _totalFees Total fees collected
     */
    function getTokenStats() external view returns (
        uint256 _totalSupply,
        uint256 _circulatingSupply,
        uint256 _totalBurned,
        uint256 _totalFees
    ) {
        return (
            TOTAL_SUPPLY,
            TOTAL_SUPPLY - totalBurned,
            totalBurned,
            totalFeesCollected
        );
    }
}
