// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title StablecoinPaymentSystem
 * @dev Payment system for Awareness Network using USDC/USDT stablecoins
 *
 * Features:
 * - Deposit USDC or USDT for credits
 * - Purchase packages using stablecoin credits
 * - Support multiple stablecoins (USDC, USDT)
 * - Withdrawal with optional cooldown
 * - Purchase history and refunds
 * - Emergency pause functionality
 *
 * Polygon Mainnet Addresses:
 * - USDC: 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
 * - USDT: 0xc2132D05D31c914a87C6611C10748AEb04B58e8F
 *
 * Polygon Amoy Testnet:
 * - Use test USDC/USDT or deploy mock tokens
 */
contract StablecoinPaymentSystem is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Roles
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // Supported stablecoins
    struct StablecoinConfig {
        bool enabled;
        uint8 decimals;
        string symbol;
    }
    mapping(address => StablecoinConfig) public supportedStablecoins;
    address[] public stablecoinList;

    // Withdrawal settings
    uint256 public withdrawalCooldown = 0; // No cooldown by default for stablecoins
    uint256 public minimumWithdrawal = 1 * 1e6; // 1 USDC/USDT minimum (6 decimals)

    // Platform fees
    uint256 public platformFeeRate = 500; // 5% in basis points (lower than $AMEM system)
    address public platformTreasury;

    // User balances (user address => stablecoin address => balance)
    // Balance stored in 6 decimal format (USDC/USDT standard)
    mapping(address => mapping(address => uint256)) public balances;

    // Withdrawal requests (for optional cooldown)
    struct WithdrawalRequest {
        address token;
        uint256 amount;
        uint256 requestTime;
        bool processed;
    }
    mapping(address => WithdrawalRequest) public withdrawalRequests;

    // Purchase records
    struct Purchase {
        string packageId;
        string packageType;
        address token;
        uint256 amountPaid;
        uint256 timestamp;
        bool refunded;
    }
    mapping(address => Purchase[]) public purchaseHistory;
    mapping(string => mapping(address => bool)) public hasPurchased;

    // Statistics per stablecoin
    mapping(address => uint256) public totalDeposited;
    mapping(address => uint256) public totalSpent;
    mapping(address => uint256) public totalWithdrawn;
    mapping(address => uint256) public totalRefunded;

    // Events
    event StablecoinAdded(address indexed token, string symbol, uint8 decimals);
    event StablecoinRemoved(address indexed token);
    event Deposited(address indexed user, address indexed token, uint256 amount, uint256 newBalance);
    event Spent(address indexed user, string packageId, string packageType, address token, uint256 amount, uint256 platformFee);
    event WithdrawalRequested(address indexed user, address indexed token, uint256 amount, uint256 availableAt);
    event Withdrawn(address indexed user, address indexed token, uint256 amount);
    event DirectWithdrawn(address indexed user, address indexed token, uint256 amount);
    event Refunded(address indexed user, string packageId, address token, uint256 amount);
    event PlatformFeeRateUpdated(uint256 oldRate, uint256 newRate);

    constructor(address _platformTreasury) {
        require(_platformTreasury != address(0), "Invalid treasury address");

        platformTreasury = _platformTreasury;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    /**
     * @dev Add a supported stablecoin
     * @param token Stablecoin contract address
     */
    function addStablecoin(address token) external onlyRole(OPERATOR_ROLE) {
        require(token != address(0), "Invalid token address");
        require(!supportedStablecoins[token].enabled, "Token already supported");

        IERC20Metadata tokenContract = IERC20Metadata(token);
        uint8 decimals = tokenContract.decimals();
        string memory symbol = tokenContract.symbol();

        supportedStablecoins[token] = StablecoinConfig({
            enabled: true,
            decimals: decimals,
            symbol: symbol
        });
        stablecoinList.push(token);

        emit StablecoinAdded(token, symbol, decimals);
    }

    /**
     * @dev Remove a supported stablecoin
     * @param token Stablecoin contract address
     */
    function removeStablecoin(address token) external onlyRole(OPERATOR_ROLE) {
        require(supportedStablecoins[token].enabled, "Token not supported");

        supportedStablecoins[token].enabled = false;

        emit StablecoinRemoved(token);
    }

    /**
     * @dev Deposit stablecoins to get credits
     * @param token Stablecoin address (USDC or USDT)
     * @param amount Amount to deposit (in token's native decimals)
     */
    function deposit(address token, uint256 amount) external whenNotPaused nonReentrant {
        require(supportedStablecoins[token].enabled, "Token not supported");
        require(amount > 0, "Amount must be positive");

        // Transfer tokens from user to contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Add to user's balance
        balances[msg.sender][token] += amount;
        totalDeposited[token] += amount;

        emit Deposited(msg.sender, token, amount, balances[msg.sender][token]);
    }

    /**
     * @dev Purchase a package using stablecoin credits
     * @param packageId Package identifier
     * @param packageType Type of package (vector/memory/chain/latentmas/wmatrix)
     * @param token Stablecoin to pay with
     * @param priceUSD Price in USD cents (e.g., 999 = $9.99)
     * @param seller Seller address to receive payment
     */
    function purchasePackage(
        string calldata packageId,
        string calldata packageType,
        address token,
        uint256 priceUSD,
        address seller
    ) external whenNotPaused nonReentrant returns (uint256 purchaseId) {
        require(supportedStablecoins[token].enabled, "Token not supported");
        require(bytes(packageId).length > 0, "Invalid package ID");
        require(seller != address(0), "Invalid seller address");
        require(priceUSD > 0, "Price must be positive");
        require(!hasPurchased[packageId][msg.sender], "Already purchased");

        // Convert USD cents to token amount
        uint256 tokenAmount = _convertUSDCentsToToken(priceUSD, token);
        require(balances[msg.sender][token] >= tokenAmount, "Insufficient balance");

        // Calculate platform fee (5%)
        uint256 platformFee = (tokenAmount * platformFeeRate) / 10000;
        uint256 sellerAmount = tokenAmount - platformFee;

        // Deduct from user's balance
        balances[msg.sender][token] -= tokenAmount;
        totalSpent[token] += tokenAmount;

        // Transfer to seller and platform
        IERC20(token).safeTransfer(seller, sellerAmount);
        IERC20(token).safeTransfer(platformTreasury, platformFee);

        // Record purchase
        purchaseHistory[msg.sender].push(Purchase({
            packageId: packageId,
            packageType: packageType,
            token: token,
            amountPaid: tokenAmount,
            timestamp: block.timestamp,
            refunded: false
        }));
        hasPurchased[packageId][msg.sender] = true;

        purchaseId = purchaseHistory[msg.sender].length - 1;

        emit Spent(msg.sender, packageId, packageType, token, tokenAmount, platformFee);
    }

    /**
     * @dev Direct purchase without depositing first (approve + purchase in one step)
     * @param packageId Package identifier
     * @param packageType Type of package
     * @param token Stablecoin to pay with
     * @param priceUSD Price in USD cents
     * @param seller Seller address
     */
    function directPurchase(
        string calldata packageId,
        string calldata packageType,
        address token,
        uint256 priceUSD,
        address seller
    ) external whenNotPaused nonReentrant returns (uint256 purchaseId) {
        require(supportedStablecoins[token].enabled, "Token not supported");
        require(bytes(packageId).length > 0, "Invalid package ID");
        require(seller != address(0), "Invalid seller address");
        require(priceUSD > 0, "Price must be positive");
        require(!hasPurchased[packageId][msg.sender], "Already purchased");

        // Convert USD cents to token amount
        uint256 tokenAmount = _convertUSDCentsToToken(priceUSD, token);

        // Calculate platform fee (5%)
        uint256 platformFee = (tokenAmount * platformFeeRate) / 10000;
        uint256 sellerAmount = tokenAmount - platformFee;

        // Transfer directly from user
        IERC20(token).safeTransferFrom(msg.sender, seller, sellerAmount);
        IERC20(token).safeTransferFrom(msg.sender, platformTreasury, platformFee);

        totalSpent[token] += tokenAmount;

        // Record purchase
        purchaseHistory[msg.sender].push(Purchase({
            packageId: packageId,
            packageType: packageType,
            token: token,
            amountPaid: tokenAmount,
            timestamp: block.timestamp,
            refunded: false
        }));
        hasPurchased[packageId][msg.sender] = true;

        purchaseId = purchaseHistory[msg.sender].length - 1;

        emit Spent(msg.sender, packageId, packageType, token, tokenAmount, platformFee);
    }

    /**
     * @dev Withdraw stablecoins directly (no cooldown by default)
     * @param token Stablecoin address
     * @param amount Amount to withdraw
     */
    function withdraw(address token, uint256 amount) external whenNotPaused nonReentrant {
        require(supportedStablecoins[token].enabled, "Token not supported");
        require(amount >= minimumWithdrawal, "Below minimum withdrawal");
        require(balances[msg.sender][token] >= amount, "Insufficient balance");

        if (withdrawalCooldown == 0) {
            // Direct withdrawal
            balances[msg.sender][token] -= amount;
            totalWithdrawn[token] += amount;

            IERC20(token).safeTransfer(msg.sender, amount);

            emit DirectWithdrawn(msg.sender, token, amount);
        } else {
            // Cooldown-based withdrawal
            require(
                withdrawalRequests[msg.sender].requestTime == 0 ||
                withdrawalRequests[msg.sender].processed,
                "Pending withdrawal exists"
            );

            withdrawalRequests[msg.sender] = WithdrawalRequest({
                token: token,
                amount: amount,
                requestTime: block.timestamp,
                processed: false
            });

            emit WithdrawalRequested(msg.sender, token, amount, block.timestamp + withdrawalCooldown);
        }
    }

    /**
     * @dev Process withdrawal after cooldown (if cooldown is enabled)
     */
    function processWithdrawal() external whenNotPaused nonReentrant {
        require(withdrawalCooldown > 0, "No cooldown enabled");

        WithdrawalRequest storage request = withdrawalRequests[msg.sender];

        require(request.requestTime > 0, "No withdrawal request");
        require(!request.processed, "Already processed");
        require(
            block.timestamp >= request.requestTime + withdrawalCooldown,
            "Cooldown not elapsed"
        );
        require(balances[msg.sender][request.token] >= request.amount, "Insufficient balance");

        address token = request.token;
        uint256 amount = request.amount;

        request.processed = true;

        balances[msg.sender][token] -= amount;
        totalWithdrawn[token] += amount;

        IERC20(token).safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, token, amount);
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
     * @param purchaseId Purchase index
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

        address token = purchase.token;
        uint256 amount = purchase.amountPaid;

        // Restore balance
        balances[user][token] += amount;
        totalRefunded[token] += amount;

        // Mark as not purchased
        hasPurchased[purchase.packageId][user] = false;

        emit Refunded(user, purchase.packageId, token, amount);
    }

    /**
     * @dev Update platform fee rate (OPERATOR_ROLE only)
     * @param newRate New rate in basis points (500 = 5%)
     */
    function updatePlatformFeeRate(uint256 newRate) external onlyRole(OPERATOR_ROLE) {
        require(newRate <= 2000, "Fee rate too high"); // Max 20%

        uint256 oldRate = platformFeeRate;
        platformFeeRate = newRate;

        emit PlatformFeeRateUpdated(oldRate, newRate);
    }

    /**
     * @dev Update withdrawal cooldown (OPERATOR_ROLE only)
     * @param newCooldown New cooldown in seconds (0 = no cooldown)
     */
    function updateWithdrawalCooldown(uint256 newCooldown) external onlyRole(OPERATOR_ROLE) {
        require(newCooldown <= 7 days, "Cooldown too long");
        withdrawalCooldown = newCooldown;
    }

    /**
     * @dev Update minimum withdrawal (OPERATOR_ROLE only)
     * @param newMinimum New minimum in 6 decimal format
     */
    function updateMinimumWithdrawal(uint256 newMinimum) external onlyRole(OPERATOR_ROLE) {
        minimumWithdrawal = newMinimum;
    }

    /**
     * @dev Convert USD cents to token amount
     * @param priceUSDCents Price in USD cents (e.g., 999 = $9.99)
     * @param token Stablecoin address
     * @return Token amount in native decimals
     */
    function _convertUSDCentsToToken(uint256 priceUSDCents, address token) internal view returns (uint256) {
        uint8 decimals = supportedStablecoins[token].decimals;
        // USDC/USDT have 6 decimals
        // 999 cents = $9.99 = 9.99 * 10^6 = 9990000
        // Formula: (cents * 10^decimals) / 100
        return (priceUSDCents * (10 ** decimals)) / 100;
    }

    /**
     * @dev Get user's balance for a specific stablecoin
     */
    function getBalance(address user, address token) external view returns (uint256) {
        return balances[user][token];
    }

    /**
     * @dev Get user's total balance across all stablecoins (in USD cents)
     */
    function getTotalBalanceUSD(address user) external view returns (uint256 totalCents) {
        for (uint256 i = 0; i < stablecoinList.length; i++) {
            address token = stablecoinList[i];
            if (supportedStablecoins[token].enabled) {
                uint8 decimals = supportedStablecoins[token].decimals;
                // Convert token amount to USD cents
                totalCents += (balances[user][token] * 100) / (10 ** decimals);
            }
        }
    }

    /**
     * @dev Get user's purchase history
     */
    function getPurchaseHistory(address user) external view returns (Purchase[] memory) {
        return purchaseHistory[user];
    }

    /**
     * @dev Check if user has purchased a package
     */
    function checkPurchased(string calldata packageId, address user) external view returns (bool) {
        return hasPurchased[packageId][user];
    }

    /**
     * @dev Get list of supported stablecoins
     */
    function getSupportedStablecoins() external view returns (address[] memory tokens, string[] memory symbols) {
        uint256 count = 0;
        for (uint256 i = 0; i < stablecoinList.length; i++) {
            if (supportedStablecoins[stablecoinList[i]].enabled) {
                count++;
            }
        }

        tokens = new address[](count);
        symbols = new string[](count);

        uint256 index = 0;
        for (uint256 i = 0; i < stablecoinList.length; i++) {
            address token = stablecoinList[i];
            if (supportedStablecoins[token].enabled) {
                tokens[index] = token;
                symbols[index] = supportedStablecoins[token].symbol;
                index++;
            }
        }
    }

    /**
     * @dev Get system statistics for a stablecoin
     */
    function getSystemStats(address token) external view returns (
        uint256 _totalDeposited,
        uint256 _totalSpent,
        uint256 _totalWithdrawn,
        uint256 _totalRefunded,
        uint256 _contractBalance
    ) {
        return (
            totalDeposited[token],
            totalSpent[token],
            totalWithdrawn[token],
            totalRefunded[token],
            IERC20(token).balanceOf(address(this))
        );
    }

    /**
     * @dev Get price in token amount
     * @param priceUSDCents Price in USD cents
     * @param token Stablecoin address
     */
    function getTokenAmount(uint256 priceUSDCents, address token) external view returns (uint256) {
        require(supportedStablecoins[token].enabled, "Token not supported");
        return _convertUSDCentsToToken(priceUSDCents, token);
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
     * @dev Emergency withdrawal (ADMIN only)
     */
    function emergencyWithdraw(address token, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        IERC20(token).safeTransfer(msg.sender, amount);
    }

    /**
     * @dev Update platform treasury address
     */
    function updateTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newTreasury != address(0), "Invalid treasury");
        platformTreasury = newTreasury;
    }
}
