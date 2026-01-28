// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AgentCreditSystem
 * @dev Credit system for AI agents using $AMEM tokens
 *
 * Features:
 * - Deposit $AMEM tokens for credits
 * - Purchase packages using credits
 * - Automatic price conversion (USD to $AMEM)
 * - Withdrawal with cooldown period
 * - Purchase history and refunds
 * - Emergency pause functionality
 *
 * This replaces mock payments in ai-agent-api.ts for production use
 */
contract AgentCreditSystem is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Roles
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PRICE_ORACLE_ROLE = keccak256("PRICE_ORACLE_ROLE");

    // $AMEM Token
    IERC20 public amemToken;

    // Price Oracle (USD to $AMEM conversion rate)
    // Rate is stored as: 1 USD = (rate / 1e18) $AMEM
    // Example: if 1 $AMEM = $0.10, then 1 USD = 10 $AMEM, rate = 10 * 1e18
    uint256 public usdToAmemRate = 10 * 1e18; // Default: 1 USD = 10 $AMEM

    // Withdrawal settings
    uint256 public withdrawalCooldown = 7 days;
    uint256 public minimumBalance = 100 * 1e18; // 100 $AMEM minimum

    // Platform fees
    uint256 public platformFeeRate = 1500; // 15% in basis points
    address public platformTreasury;

    // User balances (agent address => $AMEM balance)
    mapping(address => uint256) public credits;

    // Withdrawal requests
    struct WithdrawalRequest {
        uint256 amount;
        uint256 requestTime;
        bool processed;
    }
    mapping(address => WithdrawalRequest) public withdrawalRequests;

    // Purchase records
    struct Purchase {
        string packageId;
        string packageType;
        uint256 amountPaid;
        uint256 timestamp;
        bool refunded;
    }
    mapping(address => Purchase[]) public purchaseHistory;
    mapping(string => mapping(address => bool)) public hasPurchased; // packageId => user => purchased

    // Statistics
    uint256 public totalDeposited;
    uint256 public totalSpent;
    uint256 public totalWithdrawn;
    uint256 public totalRefunded;

    // Events
    event Deposited(address indexed user, uint256 amount, uint256 newBalance);
    event Spent(address indexed user, string packageId, string packageType, uint256 amount, uint256 platformFee);
    event WithdrawalRequested(address indexed user, uint256 amount, uint256 availableAt);
    event Withdrawn(address indexed user, uint256 amount);
    event Refunded(address indexed user, string packageId, uint256 amount);
    event PriceRateUpdated(uint256 oldRate, uint256 newRate);
    event PlatformFeeRateUpdated(uint256 oldRate, uint256 newRate);

    constructor(
        address _amemToken,
        address _platformTreasury
    ) {
        require(_amemToken != address(0), "Invalid token address");
        require(_platformTreasury != address(0), "Invalid treasury address");

        amemToken = IERC20(_amemToken);
        platformTreasury = _platformTreasury;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(PRICE_ORACLE_ROLE, msg.sender);
    }

    /**
     * @dev Deposit $AMEM tokens to get credits
     * @param amount Amount of $AMEM tokens to deposit
     */
    function deposit(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "Amount must be positive");

        // Transfer tokens from user to contract
        amemToken.safeTransferFrom(msg.sender, address(this), amount);

        // Add to user's credit balance
        credits[msg.sender] += amount;
        totalDeposited += amount;

        emit Deposited(msg.sender, amount, credits[msg.sender]);
    }

    /**
     * @dev Purchase a package using credits
     * @param packageId Package identifier
     * @param packageType Type of package (vector/memory/chain/latentmas/wmatrix)
     * @param priceUSD Price in USD (with 2 decimals, e.g., 999 = $9.99)
     * @param seller Seller address to receive payment
     */
    function purchasePackage(
        string calldata packageId,
        string calldata packageType,
        uint256 priceUSD,
        address seller
    ) external whenNotPaused nonReentrant returns (uint256 purchaseId) {
        require(bytes(packageId).length > 0, "Invalid package ID");
        require(seller != address(0), "Invalid seller address");
        require(priceUSD > 0, "Price must be positive");
        require(!hasPurchased[packageId][msg.sender], "Already purchased");

        // Convert USD price to $AMEM amount
        uint256 amemAmount = _convertUSDToAmem(priceUSD);
        require(credits[msg.sender] >= amemAmount, "Insufficient credits");

        // Calculate platform fee (15%)
        uint256 platformFee = (amemAmount * platformFeeRate) / 10000;
        uint256 sellerAmount = amemAmount - platformFee;

        // Deduct from user's credits
        credits[msg.sender] -= amemAmount;
        totalSpent += amemAmount;

        // Transfer to seller and platform
        amemToken.safeTransfer(seller, sellerAmount);
        amemToken.safeTransfer(platformTreasury, platformFee);

        // Record purchase
        purchaseHistory[msg.sender].push(Purchase({
            packageId: packageId,
            packageType: packageType,
            amountPaid: amemAmount,
            timestamp: block.timestamp,
            refunded: false
        }));
        hasPurchased[packageId][msg.sender] = true;

        purchaseId = purchaseHistory[msg.sender].length - 1;

        emit Spent(msg.sender, packageId, packageType, amemAmount, platformFee);
    }

    /**
     * @dev Request withdrawal of credits
     * @param amount Amount to withdraw
     */
    function requestWithdrawal(uint256 amount) external whenNotPaused {
        require(amount > 0, "Amount must be positive");
        require(credits[msg.sender] >= amount, "Insufficient balance");
        require(
            withdrawalRequests[msg.sender].requestTime == 0 ||
            withdrawalRequests[msg.sender].processed,
            "Pending withdrawal exists"
        );

        withdrawalRequests[msg.sender] = WithdrawalRequest({
            amount: amount,
            requestTime: block.timestamp,
            processed: false
        });

        uint256 availableAt = block.timestamp + withdrawalCooldown;

        emit WithdrawalRequested(msg.sender, amount, availableAt);
    }

    /**
     * @dev Process withdrawal after cooldown period
     */
    function processWithdrawal() external whenNotPaused nonReentrant {
        WithdrawalRequest storage request = withdrawalRequests[msg.sender];

        require(request.requestTime > 0, "No withdrawal request");
        require(!request.processed, "Already processed");
        require(
            block.timestamp >= request.requestTime + withdrawalCooldown,
            "Cooldown period not elapsed"
        );
        require(credits[msg.sender] >= request.amount, "Insufficient balance");

        uint256 amount = request.amount;

        // Mark as processed
        request.processed = true;

        // Deduct from credits
        credits[msg.sender] -= amount;
        totalWithdrawn += amount;

        // Transfer tokens back to user
        amemToken.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @dev Cancel pending withdrawal request
     */
    function cancelWithdrawal() external {
        WithdrawalRequest storage request = withdrawalRequests[msg.sender];

        require(request.requestTime > 0, "No withdrawal request");
        require(!request.processed, "Already processed");

        delete withdrawalRequests[msg.sender];
    }

    /**
     * @dev Refund a purchase (OPERATOR_ROLE only)
     * @param user User address
     * @param purchaseId Purchase index in user's history
     */
    function refundPurchase(address user, uint256 purchaseId)
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
    {
        require(purchaseId < purchaseHistory[user].length, "Invalid purchase ID");

        Purchase storage purchase = purchaseHistory[user][purchaseId];
        require(!purchase.refunded, "Already refunded");

        purchase.refunded = true;

        // Restore credits to user
        credits[user] += purchase.amountPaid;
        totalRefunded += purchase.amountPaid;

        // Mark as not purchased
        hasPurchased[purchase.packageId][user] = false;

        emit Refunded(user, purchase.packageId, purchase.amountPaid);
    }

    /**
     * @dev Update USD to $AMEM conversion rate (PRICE_ORACLE_ROLE only)
     * @param newRate New rate (1 USD = newRate / 1e18 $AMEM)
     */
    function updatePriceRate(uint256 newRate) external onlyRole(PRICE_ORACLE_ROLE) {
        require(newRate > 0, "Rate must be positive");

        uint256 oldRate = usdToAmemRate;
        usdToAmemRate = newRate;

        emit PriceRateUpdated(oldRate, newRate);
    }

    /**
     * @dev Update platform fee rate (OPERATOR_ROLE only)
     * @param newRate New rate in basis points (1500 = 15%)
     */
    function updatePlatformFeeRate(uint256 newRate) external onlyRole(OPERATOR_ROLE) {
        require(newRate <= 3000, "Fee rate too high"); // Max 30%

        uint256 oldRate = platformFeeRate;
        platformFeeRate = newRate;

        emit PlatformFeeRateUpdated(oldRate, newRate);
    }

    /**
     * @dev Update withdrawal cooldown period (OPERATOR_ROLE only)
     * @param newCooldown New cooldown in seconds
     */
    function updateWithdrawalCooldown(uint256 newCooldown) external onlyRole(OPERATOR_ROLE) {
        require(newCooldown >= 1 days, "Cooldown too short");
        require(newCooldown <= 30 days, "Cooldown too long");

        withdrawalCooldown = newCooldown;
    }

    /**
     * @dev Convert USD price to $AMEM amount
     * @param priceUSD Price in USD cents (e.g., 999 = $9.99)
     * @return $AMEM amount
     */
    function _convertUSDToAmem(uint256 priceUSD) internal view returns (uint256) {
        // priceUSD is in cents, convert to dollars first
        // Then multiply by conversion rate
        // Example: $9.99 = 999 cents, rate = 10 * 1e18 (1 USD = 10 $AMEM)
        // Result: (999 * 10 * 1e18) / 100 = 99.9 * 1e18 $AMEM
        return (priceUSD * usdToAmemRate) / 100;
    }

    /**
     * @dev Get user's purchase history
     * @param user User address
     * @return Array of purchases
     */
    function getPurchaseHistory(address user) external view returns (Purchase[] memory) {
        return purchaseHistory[user];
    }

    /**
     * @dev Get user's credit balance
     * @param user User address
     * @return Credit balance in $AMEM
     */
    function getBalance(address user) external view returns (uint256) {
        return credits[user];
    }

    /**
     * @dev Check if user has purchased a package
     * @param packageId Package identifier
     * @param user User address
     * @return Whether user has purchased
     */
    function checkPurchased(string calldata packageId, address user)
        external
        view
        returns (bool)
    {
        return hasPurchased[packageId][user];
    }

    /**
     * @dev Get withdrawal request status
     * @param user User address
     * @return request Withdrawal request details
     * @return canProcess Whether request can be processed now
     * @return timeRemaining Seconds until withdrawal can be processed
     */
    function getWithdrawalStatus(address user)
        external
        view
        returns (
            WithdrawalRequest memory request,
            bool canProcess,
            uint256 timeRemaining
        )
    {
        request = withdrawalRequests[user];

        if (request.requestTime == 0 || request.processed) {
            return (request, false, 0);
        }

        uint256 availableAt = request.requestTime + withdrawalCooldown;

        if (block.timestamp >= availableAt) {
            return (request, true, 0);
        } else {
            return (request, false, availableAt - block.timestamp);
        }
    }

    /**
     * @dev Get system statistics
     * @return _totalDeposited Total tokens deposited
     * @return _totalSpent Total spent on purchases
     * @return _totalWithdrawn Total withdrawn
     * @return _totalRefunded Total refunded
     * @return _contractBalance Current contract token balance
     */
    function getSystemStats() external view returns (
        uint256 _totalDeposited,
        uint256 _totalSpent,
        uint256 _totalWithdrawn,
        uint256 _totalRefunded,
        uint256 _contractBalance
    ) {
        return (
            totalDeposited,
            totalSpent,
            totalWithdrawn,
            totalRefunded,
            amemToken.balanceOf(address(this))
        );
    }

    /**
     * @dev Pause contract (emergency)
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Emergency withdrawal (ADMIN only, for recovering stuck tokens)
     * @param token Token address (use amemToken address or other ERC20)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}
