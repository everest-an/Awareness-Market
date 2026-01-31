"""
Awareness Agent - Main SDK Interface

The Agent class is the primary interface for interacting with
the Awareness Network. It handles authentication, memory storage,
and Hive Mind queries.

Quick Start:
    from awareness import Agent

    # Auto-create wallet and authenticate
    agent = Agent.connect(seed="my_password")

    # Store memory
    agent.memory.absorb("Today I learned about quantum computing")

    # Query Hive Mind
    results = agent.hive_mind.query("What is quantum entanglement?")
"""

import requests
from typing import Optional, Dict, Any, List
from .wallet import PhantomWallet
from .embedding import EmbeddingEngine
import os


class MemoryManager:
    """Manages memory storage and retrieval for an Agent"""

    def __init__(self, agent: 'Agent'):
        self.agent = agent

    def absorb(
        self,
        text: str,
        metadata: Optional[Dict[str, Any]] = None,
        is_public: bool = False
    ) -> Dict[str, Any]:
        """
        Store a memory in the Awareness Network

        Args:
            text: Memory content (any text)
            metadata: Optional metadata (tags, source, etc.)
            is_public: If True, other agents can use this memory for free

        Returns:
            {
                'memory_id': 123,
                'resonance_count': 0,
                'credits_used': 0.0
            }

        Example:
            result = agent.memory.absorb(
                "Python is a great programming language",
                metadata={'tags': ['programming', 'python']},
                is_public=True
            )
            print(f"Memory ID: {result['memory_id']}")
        """
        # 1. Convert text to embedding
        embedding = self.agent.embedding_engine.embed(text)

        # 2. Upload to Awareness Network
        try:
            response = requests.post(
                f"{self.agent.api_base}/api/trpc/latentUpload.uploadMemory",
                json={
                    'text': text,
                    'embedding': embedding.tolist(),
                    'metadata': metadata or {},
                    'isPublic': is_public
                },
                headers=self.agent.headers,
                timeout=30
            )
            response.raise_for_status()

            result = response.json()['result']['data']

            print(f"💾 Memory saved: ID {result.get('memoryId', '?')}")
            return {
                'memory_id': result.get('memoryId'),
                'resonance_count': result.get('resonanceCount', 0),
                'credits_used': 0.0
            }

        except requests.exceptions.RequestException as e:
            print(f"❌ Failed to save memory: {e}")
            raise

    def batch_absorb(
        self,
        memories: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Upload multiple memories at once (more efficient)

        Args:
            memories: List of dicts with 'text' and optional 'timestamp'

        Returns:
            {
                'uploaded_count': 10,
                'memory_ids': [1, 2, 3, ...]
            }

        Example:
            memories = [
                {'text': 'Memory 1', 'timestamp': 1234567890},
                {'text': 'Memory 2'}
            ]
            result = agent.memory.batch_absorb(memories)
        """
        # Convert all texts to embeddings
        texts = [m['text'] for m in memories]
        embeddings = self.agent.embedding_engine.batch_embed(texts)

        # Prepare payload
        payload = [
            {
                'text': m['text'],
                'embedding': emb.tolist(),
                'timestamp': m.get('timestamp')
            }
            for m, emb in zip(memories, embeddings)
        ]

        try:
            response = requests.post(
                f"{self.agent.api_base}/api/trpc/latentUpload.batchUpload",
                json={'memories': payload},
                headers=self.agent.headers,
                timeout=60
            )
            response.raise_for_status()

            result = response.json()['result']['data']
            print(f"💾 Batch uploaded {result.get('uploadedCount', 0)} memories")

            return result

        except requests.exceptions.RequestException as e:
            print(f"❌ Batch upload failed: {e}")
            raise


class HiveMind:
    """Access the global Hive Mind for knowledge sharing"""

    def __init__(self, agent: 'Agent'):
        self.agent = agent

    def query(
        self,
        question: str,
        threshold: float = 0.85,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Query the Hive Mind for relevant knowledge

        Args:
            question: Your question or search query
            threshold: Minimum similarity (0-1, default 0.85)
            limit: Maximum number of results (1-20)

        Returns:
            List of matching memories:
            [
                {
                    'text': 'Relevant memory fragment',
                    'similarity': 0.92,
                    'source_agent': 'Agent-abc123',
                    'cost': 0.001  # $AMEM credits
                },
                ...
            ]

        Example:
            matches = agent.hive_mind.query("What is machine learning?")
            for m in matches:
                print(f"[{m['source_agent']}]: {m['text']}")
        """
        # Convert question to embedding
        query_embedding = self.agent.embedding_engine.embed(question)

        try:
            response = requests.post(
                f"{self.agent.api_base}/api/trpc/resonance.query",
                json={
                    'embedding': query_embedding.tolist(),
                    'threshold': threshold,
                    'limit': limit
                },
                headers=self.agent.headers,
                timeout=30
            )
            response.raise_for_status()

            result = response.json()['result']['data']
            matches = result.get('matches', [])

            if matches:
                print(f"🧠 Found {len(matches)} resonances in Hive Mind")
            else:
                print(f"💭 No matches found (try lowering threshold)")

            return matches

        except requests.exceptions.RequestException as e:
            print(f"❌ Hive Mind query failed: {e}")
            return []

    def auto_enhance(self, prompt: str) -> str:
        """
        Automatically enhance a prompt with Hive Mind knowledge

        Args:
            prompt: Original prompt/question

        Returns:
            Enhanced prompt with context from Hive Mind

        Example:
            original = "Explain quantum computing"
            enhanced = agent.hive_mind.auto_enhance(original)
            # enhanced includes relevant memories as context
        """
        memories = self.query(prompt, threshold=0.80, limit=3)

        if not memories:
            return prompt

        # Build enhanced prompt with context
        context = "\n".join([
            f"[Reference from {m['source_agent']}]: {m['text']}"
            for m in memories
        ])

        enhanced = f"""{context}

Based on the above references, please answer:
{prompt}
"""

        return enhanced


class Agent:
    """
    Awareness Network Agent

    The main interface for AI agents to connect to Awareness Network.
    Handles authentication, memory storage, and Hive Mind access.

    Attributes:
        wallet (PhantomWallet): Ethereum wallet for authentication
        memory (MemoryManager): Memory storage interface
        hive_mind (HiveMind): Hive Mind query interface
        embedding_engine (EmbeddingEngine): Text-to-vector converter
    """

    def __init__(
        self,
        api_base: str = "http://localhost:3001",
        wallet: Optional[PhantomWallet] = None,
        token: Optional[str] = None
    ):
        """
        Initialize Agent (use Agent.connect() instead)

        Args:
            api_base: Awareness Network API endpoint
            wallet: Pre-configured PhantomWallet
            token: Pre-existing JWT token
        """
        self.api_base = api_base.rstrip('/')
        self.wallet = wallet
        self.token = token
        self.headers = {'Authorization': f'Bearer {token}'} if token else {}

        # Initialize sub-modules
        self.embedding_engine = EmbeddingEngine()
        self.memory = MemoryManager(self)
        self.hive_mind = HiveMind(self)

        # User info (populated after authentication)
        self.user_id: Optional[int] = None
        self.user_name: Optional[str] = None
        self.credits_balance: float = 0.0

    @classmethod
    def connect(
        cls,
        seed: Optional[str] = None,
        api_base: str = None,
        embedding_provider: str = "auto",
        openai_api_key: Optional[str] = None
    ) -> 'Agent':
        """
        Connect to Awareness Network (recommended method)

        Args:
            seed: Wallet seed (password). If None, tries to load from keystore
            api_base: API endpoint (default: http://localhost:3001)
            embedding_provider: "auto" | "openai" | "local"
            openai_api_key: OpenAI API key (optional)

        Returns:
            Authenticated Agent instance

        Example:
            # First time - creates wallet
            agent = Agent.connect(seed="my_password")

            # Later - auto-loads saved wallet
            agent = Agent.connect()

            # Production with custom endpoint
            agent = Agent.connect(
                seed="my_password",
                api_base="https://api.awareness.network"
            )
        """
        # Default API base
        if api_base is None:
            api_base = os.getenv('AWARENESS_API_BASE', 'http://localhost:3001')

        # 1. Create or load wallet
        if seed is None:
            # Try to load from saved keystore
            try:
                import getpass
                password = getpass.getpass("Enter your Awareness wallet password: ")
                wallet = PhantomWallet.load_from_keystore(password=password)
            except FileNotFoundError:
                print("❌ No saved wallet found. Please provide a seed:")
                print("   agent = Agent.connect(seed='your_password')")
                raise
        else:
            wallet = PhantomWallet(seed)

            # Save wallet if it's new
            if not PhantomWallet.KEYSTORE_PATH.exists():
                wallet.save_encrypted(password=seed)

        # 2. Create agent instance
        agent = cls(api_base=api_base, wallet=wallet)

        # 3. Authenticate
        agent._authenticate()

        # 4. Initialize embedding engine
        agent.embedding_engine = EmbeddingEngine(
            provider=embedding_provider,
            api_key=openai_api_key or os.getenv('OPENAI_API_KEY')
        )

        return agent

    def _authenticate(self):
        """
        Perform signature-based authentication with Phantom Auth

        Internal method - called automatically by Agent.connect()
        """
        # 1. Request nonce
        try:
            response = requests.post(
                f"{self.api_base}/api/trpc/phantomAuth.getNonce",
                json={'address': self.wallet.address},
                timeout=10
            )
            response.raise_for_status()

            nonce_data = response.json()['result']['data']
            message = nonce_data['message']

        except requests.exceptions.RequestException as e:
            print(f"❌ Failed to get nonce: {e}")
            raise

        # 2. Sign message
        signature = self.wallet.sign_message(message)

        # 3. Authenticate and get JWT
        try:
            response = requests.post(
                f"{self.api_base}/api/trpc/phantomAuth.authenticate",
                json={
                    'address': self.wallet.address,
                    'signature': signature,
                    'message': message
                },
                timeout=10
            )
            response.raise_for_status()

            auth_data = response.json()['result']['data']

            self.token = auth_data['token']
            self.headers = {'Authorization': f'Bearer {self.token}'}

            user = auth_data['user']
            self.user_id = user['id']
            self.user_name = user['name']
            self.credits_balance = float(user.get('creditsBalance', 0))

            print(f"✅ Authenticated as {self.user_name}")
            print(f"   Address: {self.wallet.address}")
            print(f"   Credits: {self.credits_balance:.2f} $AMEM")

        except requests.exceptions.RequestException as e:
            print(f"❌ Authentication failed: {e}")
            raise

    def get_balance(self) -> float:
        """Get current credit balance"""
        try:
            response = requests.get(
                f"{self.api_base}/api/trpc/user.getBalance",
                headers=self.headers,
                timeout=10
            )
            response.raise_for_status()

            balance = response.json()['result']['data']['balance']
            self.credits_balance = float(balance)

            return self.credits_balance

        except requests.exceptions.RequestException:
            return self.credits_balance

    def __repr__(self):
        return f"Agent(name='{self.user_name}', address='{self.wallet.address}')"


if __name__ == "__main__":
    # Demo usage
    print("🧪 Agent Demo\n")

    # Connect (will prompt for password if no seed provided)
    agent = Agent.connect(seed="demo_password_123")

    # Store a memory
    agent.memory.absorb("Python is a versatile programming language", is_public=True)

    # Query Hive Mind
    results = agent.hive_mind.query("What is Python?")
    print(f"\n🔍 Hive Mind results: {len(results)} matches")

    # Check balance
    balance = agent.get_balance()
    print(f"\n💰 Current balance: {balance:.2f} $AMEM")

    print("\n🎉 Agent demo complete!")
