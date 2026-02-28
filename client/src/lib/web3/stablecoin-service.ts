/**
 * StablecoinService — On-chain Stablecoin Payment Operations
 *
 * Encapsulates all browser-side ERC-20 and StablecoinPaymentSystem
 * contract interactions. Depends on `Web3Provider` for the connected
 * signer; does NOT manage wallet connection itself.
 *
 * Responsibilities:
 * - Query ERC-20 and contract balances
 * - Check allowances and approve spend
 * - Execute `directPurchase` (approve + purchase in one method)
 * - Deposit / withdraw stablecoins to/from the payment contract
 *
 * NOT responsible for:
 * - Wallet connection / network switching (see wallet-provider.ts)
 * - UI state management (see useStablecoinPayment.ts)
 */

import { ethers } from 'ethers';
import type { Web3Provider } from './wallet-provider';
import { getWeb3Provider } from './wallet-provider';
import type { DirectPurchaseResult, StablecoinSymbol } from './types';
import {
  STABLECOIN_ADDRESSES,
  STABLECOIN_PAYMENT_ADDRESS,
  ERC20_ABI,
  STABLECOIN_PAYMENT_ABI,
  STABLECOIN_DECIMALS,
} from './constants';

export class StablecoinService {
  private web3Provider: Web3Provider;
  private network: 'mainnet' | 'fuji';

  /**
   * @param web3Provider - Connected wallet provider
   * @param network      - Target Avalanche network (default: 'mainnet')
   */
  constructor(web3Provider: Web3Provider, network: 'mainnet' | 'fuji' = 'mainnet') {
    this.web3Provider = web3Provider;
    this.network = network;
  }

  /** Switch the service to target a different Avalanche network */
  setNetwork(network: 'mainnet' | 'fuji'): void {
    this.network = network;
  }

  /** Contract address for the given token symbol on the active network */
  getTokenAddress(symbol: StablecoinSymbol): string {
    return STABLECOIN_ADDRESSES[this.network][symbol];
  }

  // --------------------------------------------------------------------------
  // Balance queries
  // --------------------------------------------------------------------------

  /**
   * Get the wallet balance of a stablecoin ERC-20 token.
   *
   * @param tokenAddress - ERC-20 contract address
   * @returns Human-readable balance string (e.g. "100.000000")
   * @throws Error if wallet is not connected
   */
  async getWalletBalance(tokenAddress: string): Promise<string> {
    const { provider, address } = this.requireConnected();
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const [balance, decimals] = await Promise.all([
      contract.balanceOf(address) as Promise<bigint>,
      contract.decimals() as Promise<bigint>,
    ]);
    return ethers.formatUnits(balance, decimals);
  }

  /**
   * Get the balance of a stablecoin deposited in the payment contract.
   *
   * @param tokenAddress - ERC-20 contract address
   * @returns Human-readable deposited balance string
   */
  async getPaymentContractBalance(tokenAddress: string): Promise<string> {
    const { provider, address } = this.requireConnected();
    const contract = new ethers.Contract(
      STABLECOIN_PAYMENT_ADDRESS,
      STABLECOIN_PAYMENT_ABI,
      provider
    );
    const balance: bigint = await contract.getBalance(address, tokenAddress);
    return ethers.formatUnits(balance, STABLECOIN_DECIMALS);
  }

  /**
   * Check whether the connected wallet has already purchased a package.
   *
   * @param packageId - Package identifier to check
   * @returns true if already purchased
   */
  async hasPurchased(packageId: string): Promise<boolean> {
    const { provider, address } = this.requireConnected();
    const contract = new ethers.Contract(
      STABLECOIN_PAYMENT_ADDRESS,
      STABLECOIN_PAYMENT_ABI,
      provider
    );
    return contract.checkPurchased(packageId, address) as Promise<boolean>;
  }

  /**
   * Query the exact token amount the contract will charge for a USD price.
   *
   * Uses `getTokenAmount(priceCents, tokenAddress)` on-chain so the result
   * is guaranteed to match what `directPurchase` will deduct.
   *
   * @param priceUSD     - Package price in USD (floating-point OK, rounded to cents)
   * @param tokenAddress - ERC-20 contract address of the stablecoin
   * @returns Human-readable token amount string
   */
  async getTokenAmount(priceUSD: number, tokenAddress: string): Promise<string> {
    const { provider } = this.requireConnected();
    const contract = new ethers.Contract(
      STABLECOIN_PAYMENT_ADDRESS,
      STABLECOIN_PAYMENT_ABI,
      provider
    );
    const priceCents = Math.round(priceUSD * 100);
    const amount: bigint = await contract.getTokenAmount(priceCents, tokenAddress);
    return ethers.formatUnits(amount, STABLECOIN_DECIMALS);
  }

  // --------------------------------------------------------------------------
  // Write operations
  // --------------------------------------------------------------------------

  /**
   * Approve the payment contract to spend up to `amount` of `tokenAddress`.
   *
   * @param tokenAddress - ERC-20 contract address
   * @param amount       - Human-readable amount string (e.g. "50.00")
   * @returns Transaction hash of the approval tx
   */
  async approve(tokenAddress: string, amount: string): Promise<string> {
    const signer = await this.requireSigner();
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const amountWei = ethers.parseUnits(amount, STABLECOIN_DECIMALS);
    const tx = await contract.approve(STABLECOIN_PAYMENT_ADDRESS, amountWei);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Deposit stablecoins into the payment contract.
   *
   * Checks current allowance first; only sends an approve tx if needed,
   * saving the user an unnecessary wallet popup.
   *
   * @param tokenAddress - ERC-20 contract address
   * @param amount       - Human-readable amount to deposit (e.g. "100.00")
   * @returns Transaction hash of the deposit tx
   */
  async deposit(tokenAddress: string, amount: string): Promise<string> {
    const { address } = this.requireConnected();
    const signer = await this.requireSigner();
    const amountWei = ethers.parseUnits(amount, STABLECOIN_DECIMALS);

    const erc20 = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

    // Approve only if the existing allowance is insufficient
    const currentAllowance: bigint = await erc20.allowance(address, STABLECOIN_PAYMENT_ADDRESS);
    if (currentAllowance < amountWei) {
      const approveTx = await erc20.approve(STABLECOIN_PAYMENT_ADDRESS, amountWei);
      await approveTx.wait();
    }

    const paymentContract = new ethers.Contract(
      STABLECOIN_PAYMENT_ADDRESS,
      STABLECOIN_PAYMENT_ABI,
      signer
    );
    const tx = await paymentContract.deposit(tokenAddress, amountWei);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Execute a direct package purchase from the user's browser wallet.
   *
   * Performs approve (if needed) + `directPurchase` in sequence.
   * The token amount is fetched on-chain first so the approval is exact.
   *
   * @param packageId     - Marketplace package identifier
   * @param packageType   - 'vector' | 'memory' | 'chain'
   * @param tokenAddress  - ERC-20 contract address of the stablecoin
   * @param priceUSD      - Package price in USD
   * @param sellerAddress - Seller's wallet address (from server quote)
   * @returns Object containing the purchase transaction hash
   */
  async directPurchase(
    packageId: string,
    packageType: string,
    tokenAddress: string,
    priceUSD: number,
    sellerAddress: string
  ): Promise<DirectPurchaseResult> {
    const { address } = this.requireConnected();
    const signer = await this.requireSigner();

    const erc20 = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const paymentContract = new ethers.Contract(
      STABLECOIN_PAYMENT_ADDRESS,
      STABLECOIN_PAYMENT_ABI,
      signer
    );

    const priceCents = Math.round(priceUSD * 100);
    const tokenAmountWei: bigint = await paymentContract.getTokenAmount(priceCents, tokenAddress);

    const currentAllowance: bigint = await erc20.allowance(address, STABLECOIN_PAYMENT_ADDRESS);
    if (currentAllowance < tokenAmountWei) {
      const approveTx = await erc20.approve(STABLECOIN_PAYMENT_ADDRESS, tokenAmountWei);
      await approveTx.wait();
    }

    const purchaseTx = await paymentContract.directPurchase(
      packageId,
      packageType,
      tokenAddress,
      priceCents,
      sellerAddress
    );
    const receipt = await purchaseTx.wait();

    return { txHash: receipt.hash };
  }

  /**
   * Withdraw stablecoins from the payment contract to the user's wallet.
   *
   * @param tokenAddress - ERC-20 contract address
   * @param amount       - Human-readable amount to withdraw
   * @returns Transaction hash
   */
  async withdraw(tokenAddress: string, amount: string): Promise<string> {
    const signer = await this.requireSigner();
    const contract = new ethers.Contract(
      STABLECOIN_PAYMENT_ADDRESS,
      STABLECOIN_PAYMENT_ABI,
      signer
    );
    const amountWei = ethers.parseUnits(amount, STABLECOIN_DECIMALS);
    const tx = await contract.withdraw(tokenAddress, amountWei);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  /** Assert wallet is connected and return provider + address */
  private requireConnected(): { provider: ethers.BrowserProvider; address: string } {
    const provider = this.web3Provider.getBrowserProvider();
    const address = this.web3Provider.getAddress();
    if (!provider || !address) throw new Error('Wallet not connected');
    return { provider, address };
  }

  /** Return an ethers.Signer; throws if not connected */
  private async requireSigner(): Promise<ethers.Signer> {
    return this.web3Provider.getSigner();
  }
}

// ============================================================================
// Module-level singleton
// ============================================================================

let _instance: StablecoinService | null = null;

/**
 * Return the shared `StablecoinService` singleton.
 * Lazily imports `getWeb3Provider` to avoid a circular dependency at module load.
 */
export function getStablecoinService(): StablecoinService {
  if (!_instance) {
    _instance = new StablecoinService(getWeb3Provider());
  }
  return _instance;
}
