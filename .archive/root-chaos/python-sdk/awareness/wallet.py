"""
Phantom Wallet - Zero-configuration Ethereum wallet for AI Agents

Automatically generates deterministic wallets from simple seeds,
eliminating the need for MetaMask or WalletConnect.

Example:
    wallet = PhantomWallet(seed="my_password")
    print(wallet.address)  # 0x742d35f8b2a1c4e9d3f6a8b7c5e2d1f9a3b4c8f3
    signature = wallet.sign_message("Hello, Awareness!")
"""

from eth_account import Account
from eth_account.messages import encode_defunct
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
from cryptography.hazmat.backends import default_backend
from cryptography.fernet import Fernet
import os
import json
from pathlib import Path
import base64


class PhantomWallet:
    """
    Invisible Ethereum wallet for AI Agents

    Creates deterministic wallets from simple seed phrases,
    removing Web3 complexity from the developer experience.

    Attributes:
        address (str): Ethereum address (0x...)
        account (Account): eth_account Account instance
    """

    KEYSTORE_PATH = Path.home() / ".awareness" / "keystore.json"
    DEFAULT_SALT = "awareness_network_v2"  # Version-specific salt
    ITERATIONS = 100000  # PBKDF2 iterations (industry standard)

    def __init__(self, seed: str, salt: str = None):
        """
        Initialize wallet from seed

        Args:
            seed: User-provided password/seed phrase (any string)
            salt: Optional custom salt (default: "awareness_network_v2")

        Example:
            wallet1 = PhantomWallet(seed="my_secret")
            wallet2 = PhantomWallet(seed="my_secret")
            assert wallet1.address == wallet2.address  # Deterministic!
        """
        self.seed = seed
        self.salt = salt or self.DEFAULT_SALT
        self._private_key = self._derive_key()
        self.account = Account.from_key(self._private_key)

    def _derive_key(self) -> bytes:
        """
        Derive private key from seed using PBKDF2

        PBKDF2 (Password-Based Key Derivation Function 2) is a standard
        algorithm for deriving cryptographic keys from passwords.

        Returns:
            32-byte private key
        """
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,  # 256 bits = 32 bytes
            salt=self.salt.encode('utf-8'),
            iterations=self.ITERATIONS,
            backend=default_backend()
        )
        return kdf.derive(self.seed.encode('utf-8'))

    @property
    def address(self) -> str:
        """Get Ethereum address (checksum format)"""
        return self.account.address

    @property
    def private_key_hex(self) -> str:
        """Get private key as hex string (USE WITH CAUTION!)"""
        return self._private_key.hex()

    def sign_message(self, message: str) -> str:
        """
        Sign a message (used for ERC-8004 authentication)

        Args:
            message: Plain text message to sign

        Returns:
            Signature as hex string (0x...)

        Example:
            signature = wallet.sign_message("Sign in to Awareness")
            # Returns: "0x1234...abcd"
        """
        message_hash = encode_defunct(text=message)
        signed = self.account.sign_message(message_hash)
        return signed.signature.hex()

    def save_encrypted(self, password: str = None):
        """
        Save wallet to encrypted keystore file

        Args:
            password: Encryption password (default: use seed)

        The keystore is saved to ~/.awareness/keystore.json
        with AES-256 encryption.
        """
        password = password or self.seed

        # Derive encryption key from password
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,
            salt=self.salt.encode('utf-8'),
            iterations=self.ITERATIONS,
            backend=default_backend()
        )
        encryption_key = base64.urlsafe_b64encode(kdf.derive(password.encode('utf-8')))
        cipher = Fernet(encryption_key)

        # Encrypt private key
        encrypted_key = cipher.encrypt(self._private_key)

        # Save to file
        self.KEYSTORE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(self.KEYSTORE_PATH, 'w') as f:
            json.dump({
                'address': self.address,
                'encrypted_key': encrypted_key.hex(),
                'salt': self.salt,
                'iterations': self.ITERATIONS,
                'version': '2.1.0'
            }, f, indent=2)

        print(f"💾 Wallet saved to {self.KEYSTORE_PATH}")

    @classmethod
    def load_from_keystore(cls, password: str = None) -> 'PhantomWallet':
        """
        Load wallet from encrypted keystore

        Args:
            password: Decryption password

        Returns:
            PhantomWallet instance

        Raises:
            FileNotFoundError: If keystore doesn't exist
            ValueError: If password is incorrect

        Example:
            wallet = PhantomWallet.load_from_keystore(password="my_password")
        """
        if not cls.KEYSTORE_PATH.exists():
            raise FileNotFoundError(
                f"No keystore found at {cls.KEYSTORE_PATH}\n"
                f"Create one with: wallet = PhantomWallet(seed='...')\n"
                f"                 wallet.save_encrypted()"
            )

        with open(cls.KEYSTORE_PATH) as f:
            data = json.load(f)

        if password is None:
            raise ValueError("Password required to decrypt keystore")

        # Derive decryption key
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,
            salt=data['salt'].encode('utf-8'),
            iterations=data['iterations'],
            backend=default_backend()
        )
        encryption_key = base64.urlsafe_b64encode(kdf.derive(password.encode('utf-8')))
        cipher = Fernet(encryption_key)

        try:
            # Decrypt private key
            decrypted_key = cipher.decrypt(bytes.fromhex(data['encrypted_key']))

            # Create wallet instance
            wallet = cls.__new__(cls)
            wallet.seed = password
            wallet.salt = data['salt']
            wallet._private_key = decrypted_key
            wallet.account = Account.from_key(decrypted_key)

            print(f"🔓 Wallet loaded: {wallet.address}")
            return wallet

        except Exception as e:
            raise ValueError(f"Failed to decrypt keystore: {e}")

    def delete_keystore(self):
        """Delete saved keystore (USE WITH CAUTION!)"""
        if self.KEYSTORE_PATH.exists():
            self.KEYSTORE_PATH.unlink()
            print(f"🗑️  Keystore deleted: {self.KEYSTORE_PATH}")
        else:
            print(f"⚠️  No keystore found at {self.KEYSTORE_PATH}")

    def __repr__(self):
        return f"PhantomWallet(address='{self.address}')"

    def __str__(self):
        return self.address


if __name__ == "__main__":
    # Demo usage
    print("🧪 PhantomWallet Demo\n")

    # Create wallet
    wallet = PhantomWallet(seed="demo_password_123")
    print(f"✅ Created wallet: {wallet.address}")

    # Sign message
    message = "Hello, Awareness Network!"
    signature = wallet.sign_message(message)
    print(f"✅ Signed message: {signature[:66]}...")

    # Save encrypted
    wallet.save_encrypted()

    # Load from keystore
    loaded_wallet = PhantomWallet.load_from_keystore(password="demo_password_123")
    print(f"✅ Loaded wallet: {loaded_wallet.address}")

    assert wallet.address == loaded_wallet.address, "Addresses should match!"

    # Cleanup
    wallet.delete_keystore()

    print("\n🎉 All tests passed!")
