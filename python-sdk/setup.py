"""
Setup script for Awareness SDK
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="awareness-sdk",
    version="1.0.0",
    author="Awareness Market Team",
    author_email="support@awareness.market",
    description="Python SDK for LatentMAS Awareness Marketplace - Trade AI latent vectors and W-Matrix alignment tools",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/everest-an/Awareness-Market",
    project_urls={
        "Bug Tracker": "https://github.com/everest-an/Awareness-Market/issues",
        "Documentation": "https://awareness.market/docs",
        "Source Code": "https://github.com/everest-an/Awareness-Market",
        "Homepage": "https://awareness.market",
    },
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Intended Audience :: Science/Research",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.28.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=4.0.0",
            "black>=22.0.0",
            "flake8>=5.0.0",
            "mypy>=0.990",
        ],
    },
    keywords=[
        "ai",
        "machine-learning",
        "latent-vectors",
        "kv-cache",
        "w-matrix",
        "model-alignment",
        "latentmas",
        "awareness",
        "marketplace",
        "sdk",
    ],
)
