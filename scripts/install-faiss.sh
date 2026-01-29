#!/bin/bash

###############################################################################
# FAISS Installation Script
#
# Installs FAISS (Facebook AI Similarity Search) Python library
# for high-performance vector similarity search.
#
# Usage:
#   bash scripts/install-faiss.sh
#   bash scripts/install-faiss.sh --gpu  # For GPU support
###############################################################################

set -e

echo "========================================="
echo "  FAISS Installation Script"
echo "========================================="
echo ""

# Check if Python is installed
if ! command -v python &> /dev/null && ! command -v python3 &> /dev/null; then
    echo "❌ Python is not installed. Please install Python 3.7+ first."
    exit 1
fi

PYTHON_CMD="python3"
if ! command -v python3 &> /dev/null; then
    PYTHON_CMD="python"
fi

echo "✓ Found Python: $PYTHON_CMD"
$PYTHON_CMD --version
echo ""

# Check if pip is installed
if ! $PYTHON_CMD -m pip --version &> /dev/null; then
    echo "❌ pip is not installed. Installing pip..."
    curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
    $PYTHON_CMD get-pip.py
    rm get-pip.py
fi

echo "✓ pip is installed"
echo ""

# Determine installation type (CPU or GPU)
GPU_SUPPORT=false
if [ "$1" == "--gpu" ]; then
    GPU_SUPPORT=true
fi

# Install FAISS
echo "📦 Installing FAISS..."

if [ "$GPU_SUPPORT" == true ]; then
    echo "  Installing FAISS with GPU support..."
    $PYTHON_CMD -m pip install faiss-gpu
else
    echo "  Installing FAISS (CPU version)..."
    $PYTHON_CMD -m pip install faiss-cpu
fi

echo "✓ FAISS installed successfully"
echo ""

# Install additional dependencies
echo "📦 Installing additional dependencies..."
$PYTHON_CMD -m pip install numpy

echo "✓ Dependencies installed"
echo ""

# Verify installation
echo "🔍 Verifying FAISS installation..."

$PYTHON_CMD -c "
import faiss
import numpy as np

# Test FAISS
dimension = 128
index = faiss.IndexFlatL2(dimension)

# Add some vectors
vectors = np.random.random((100, dimension)).astype('float32')
index.add(vectors)

# Search
query = np.random.random((1, dimension)).astype('float32')
distances, indices = index.search(query, 5)

print('✓ FAISS verification successful')
print(f'  Created index with {index.ntotal} vectors')
print(f'  Dimension: {index.d}')
print(f'  Search completed: found {len(indices[0])} results')
"

echo ""
echo "========================================="
echo "  ✅ Installation Complete!"
echo "========================================="
echo ""

if [ "$GPU_SUPPORT" == true ]; then
    echo "GPU Support: ✓ Enabled"
    echo ""
    echo "⚠️  Note: GPU support requires CUDA-capable GPU and NVIDIA drivers"
    echo "   Check GPU availability with: python -c 'import faiss; print(faiss.get_num_gpus())'"
else
    echo "CPU Support: ✓ Enabled"
    echo ""
    echo "💡 Tip: For GPU support, run: bash scripts/install-faiss.sh --gpu"
fi

echo ""
echo "Next steps:"
echo "  1. Run migration: npm run migrate:faiss"
echo "  2. Update search endpoints to use FAISS"
echo "  3. Monitor performance improvements (10-100x expected)"
echo ""
