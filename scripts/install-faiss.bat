@echo off
REM ###############################################################################
REM FAISS Installation Script for Windows
REM
REM Installs FAISS (Facebook AI Similarity Search) Python library
REM for high-performance vector similarity search.
REM
REM Usage:
REM   scripts\install-faiss.bat
REM   scripts\install-faiss.bat gpu  (for GPU support)
REM ###############################################################################

echo =========================================
echo   FAISS Installation Script (Windows)
echo =========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed. Please install Python 3.7+ first.
    echo Download from: https://www.python.org/downloads/
    exit /b 1
)

echo Found Python:
python --version
echo.

REM Check if pip is installed
python -m pip --version >nul 2>&1
if errorlevel 1 (
    echo Error: pip is not installed.
    echo Installing pip...
    python -m ensurepip --upgrade
)

echo pip is installed
echo.

REM Determine installation type
set GPU_SUPPORT=0
if "%1"=="gpu" set GPU_SUPPORT=1

REM Install FAISS
echo Installing FAISS...

if %GPU_SUPPORT%==1 (
    echo   Installing FAISS with GPU support...
    python -m pip install faiss-gpu
) else (
    echo   Installing FAISS CPU version...
    python -m pip install faiss-cpu
)

if errorlevel 1 (
    echo.
    echo Error: FAISS installation failed.
    echo.
    echo Troubleshooting:
    echo   1. Ensure you have Visual C++ Build Tools installed
    echo   2. Try: python -m pip install --upgrade pip
    echo   3. Try: python -m pip install faiss-cpu --no-cache-dir
    exit /b 1
)

echo FAISS installed successfully
echo.

REM Install additional dependencies
echo Installing additional dependencies...
python -m pip install numpy

echo Dependencies installed
echo.

REM Verify installation
echo Verifying FAISS installation...

python -c "import faiss; import numpy as np; dim=128; idx=faiss.IndexFlatL2(dim); vecs=np.random.random((100,dim)).astype('float32'); idx.add(vecs); print('FAISS verification successful'); print(f'Created index with {idx.ntotal} vectors')"

if errorlevel 1 (
    echo.
    echo Warning: FAISS verification failed. Please check the installation.
    exit /b 1
)

echo.
echo =========================================
echo   Installation Complete!
echo =========================================
echo.

if %GPU_SUPPORT%==1 (
    echo GPU Support: Enabled
    echo.
    echo Note: GPU support requires CUDA-capable GPU and NVIDIA drivers
    echo Check GPU: python -c "import faiss; print(f'GPUs available: {faiss.get_num_gpus()}')"
) else (
    echo CPU Support: Enabled
    echo.
    echo Tip: For GPU support, run: scripts\install-faiss.bat gpu
)

echo.
echo Next steps:
echo   1. Run migration: npm run migrate:faiss
echo   2. Update search endpoints to use FAISS
echo   3. Monitor performance improvements 10-100x expected
echo.

pause
