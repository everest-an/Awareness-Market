"""
Awareness Network Python SDK

The Subconscious Cloud for AI - Give your AI infinite memory
and cross-platform intelligence with one line of code.
"""

from setuptools import setup, find_packages
from pathlib import Path

# Read README for long description
this_directory = Path(__file__).parent
long_description = (this_directory / "README.md").read_text() if (this_directory / "README.md").exists() else __doc__

setup(
    name="awareness-agent",
    version="2.1.0",
    author="Awareness Network Team",
    author_email="noreply@awareness.network",
    description="The Subconscious Cloud for AI - Infinite memory for AI agents",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/everest-an/Awareness-Market",
    project_urls={
        "Documentation": "https://docs.awareness.network",
        "Source": "https://github.com/everest-an/Awareness-Market",
        "Bug Reports": "https://github.com/everest-an/Awareness-Market/issues",
    },
    packages=find_packages(exclude=["tests", "examples"]),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.28.0",
        "python-dotenv>=0.20.0",
        "eth-account>=0.8.0",
        "web3>=6.0.0",
        "cryptography>=41.0.0",
    ],
    extras_require={
        "local": [
            "sentence-transformers>=2.2.0",
            "torch>=2.0.0",
            "numpy>=1.24.0",
        ],
        "openai": [
            "openai>=1.0.0",
        ],
        "dev": [
            "pytest>=7.4.0",
            "pytest-cov>=4.1.0",
            "black>=23.0.0",
            "mypy>=1.5.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "awareness=awareness.cli:main",
        ],
    },
    keywords=[
        "ai",
        "agents",
        "memory",
        "neural-bridge",
        "embeddings",
        "llm",
        "machine-learning",
        "artificial-intelligence",
    ],
    include_package_data=True,
)
