"""
Setup configuration for Awareness Network SDK
"""

from setuptools import setup, find_packages
import os

# Read long description from README
with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

# Read version from __init__.py
version = "1.0.0"

setup(
    name="awareness-network-sdk",
    version=version,
    author="Awareness Network Team",
    author_email="support@awareness-network.com",
    description="Python SDK for Awareness Network - AI-to-AI latent space vector marketplace",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/everest-an/Awareness-Market",
    project_urls={
        "Bug Tracker": "https://github.com/everest-an/Awareness-Market/issues",
        "Documentation": "https://awareness-network.com/docs",
        "Source Code": "https://github.com/everest-an/Awareness-Market",
        "Homepage": "https://awareness-network.com",
    },
    packages=find_packages(exclude=["tests", "tests.*", "examples"]),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Intended Audience :: Science/Research",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Operating System :: OS Independent",
        "Typing :: Typed",
    ],
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.28.0",
        "aiohttp>=3.8.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "pytest-cov>=4.0.0",
            "black>=23.0.0",
            "mypy>=1.0.0",
            "flake8>=6.0.0",
            "isort>=5.12.0",
        ],
        "docs": [
            "sphinx>=6.0.0",
            "sphinx-rtd-theme>=1.2.0",
            "sphinx-autodoc-typehints>=1.22.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "awareness-cli=awareness_network_sdk.cli:main",
        ],
    },
    include_package_data=True,
    package_data={
        "awareness_network_sdk": ["py.typed", "*.pyi"],
    },
    keywords=[
        "ai",
        "machine-learning",
        "latent-space",
        "vector",
        "marketplace",
        "neural-bridge",
        "mcp",
        "ai-agents",
        "neural-networks",
    ],
    zip_safe=False,
)
