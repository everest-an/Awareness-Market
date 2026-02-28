@echo off
REM AI Collaboration Setup Script (Windows)

echo ================================================================
echo     AI Collaboration System - Setup
echo ================================================================
echo.

REM Step 1: Build MCP Collaboration Server
echo [1/4] Building MCP Collaboration Server...
cd mcp-server

where pnpm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Warning: pnpm not found. Using npm instead.
    call npm install
    call npm run build:collab
) else (
    call pnpm install
    call pnpm run build:collab
)

echo [32m√[0m MCP server built successfully
echo.

REM Step 2: Build Project Manager
echo [1/4] Building Project Manager...
call npx tsc project-manager.ts --outDir dist --module ESNext --moduleResolution node --esModuleInterop

echo [32m√[0m Project manager built successfully
echo.

REM Step 3: Create example project
echo [3/4] Creating example project...
node dist/project-manager.js create "Awareness Platform Development" "client_awareness" "Awareness Market Team"

echo.

REM Step 4: List projects
echo [4/4] Listing projects...
node dist/project-manager.js list

echo.
echo ================================================================
echo   Setup Complete!
echo ================================================================
echo.
echo Next steps:
echo   1. Check .ai-collaboration/projects.json for project details
echo   2. Generate MCP config for your agents:
echo      node mcp-server/dist/project-manager.js config PROJECT_ID frontend
echo   3. Copy config to your AI agent's configuration file
echo.
echo Documentation:
echo   - AI_COLLABORATION_QUICKSTART.md
echo   - AI_COLLABORATION_MULTI_CLIENT.md
echo.

cd ..
pause
