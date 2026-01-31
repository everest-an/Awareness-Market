"""
Awareness Network Python SDK v2.1.0
The Subconscious Cloud for AI

Quick Start:
    from awareness import Agent

    agent = Agent.connect(seed="my_password")
    agent.memory.absorb("Today I learned about AI")
    results = agent.hive_mind.query("What is machine learning?")
"""

__version__ = "2.1.0"

from .wallet import PhantomWallet
from .embedding import EmbeddingEngine
from .agent import Agent

__all__ = ["Agent", "PhantomWallet", "EmbeddingEngine"]
