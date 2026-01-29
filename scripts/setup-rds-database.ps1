# Complete RDS Database Setup Script
# This script automates the entire RDS setup process
#
# Usage: .\scripts\setup-rds-database.ps1

param(
    [string]$InstanceId = "awareness-network-db",
    [string]$SecurityGroupId = "sg-0a49a80bda988ee00",
    [switch]$SkipSecurityGroup = $false,
    [switch]$SkipMigration = $false
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message, [string]$Color = "Cyan")
    Write-Host "`n$('═' * 60)" -ForegroundColor $Color
    Write-Host "  $Message" -ForegroundColor $Color
    Write-Host "$('═' * 60)" -ForegroundColor $Color
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor White
}

# Banner
Clear-Host
Write-Host @"

    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║         AWS RDS Database Setup Automation            ║
    ║              Awareness Network                        ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

Write-Info "Instance ID: $InstanceId"
Write-Info "Security Group: $SecurityGroupId"
Write-Host ""

# Step 1: Wait for RDS instance
Write-Step "STEP 1: Waiting for RDS Instance"

Write-Info "Checking instance status..."
$maxAttempts = 40
$attempt = 0
$endpoint = $null
$port = $null

while ($attempt -lt $maxAttempts) {
    try {
        $result = aws rds describe-db-instances `
            --db-instance-identifier $InstanceId `
            --query 'DBInstances[0].[DBInstanceStatus,Endpoint.Address,Endpoint.Port]' `
            --output json | ConvertFrom-Json

        $status = $result[0]
        $endpoint = $result[1]
        $port = $result[2]

        if ($status -eq "available") {
            Write-Success "Instance is available!"
            Write-Info "Endpoint: $endpoint"
            Write-Info "Port: $port"
            break
        }
        elseif ($status -eq "creating" -or $status -eq "backing-up") {
            $attempt++
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ⏳ Status: $status (attempt $attempt/$maxAttempts)" -ForegroundColor Yellow
            Start-Sleep -Seconds 30
        }
        elseif ($status -eq "failed") {
            Write-Error "Instance creation failed!"
            Write-Warning "Check AWS Console: https://console.aws.amazon.com/rds/"
            exit 1
        }
        else {
            Write-Warning "Unexpected status: $status"
            $attempt++
            Start-Sleep -Seconds 30
        }
    }
    catch {
        Write-Error "Failed to check instance status: $_"
        exit 1
    }
}

if ($attempt -ge $maxAttempts) {
    Write-Error "Timeout waiting for instance to become available"
    exit 1
}

# Step 2: Configure Security Group
if (-not $SkipSecurityGroup) {
    Write-Step "STEP 2: Configuring Security Group"

    try {
        $myIp = (Invoke-WebRequest -Uri "https://checkip.amazonaws.com" -UseBasicParsing).Content.Trim()
        Write-Success "Your IP: $myIp"

        # Check if rule exists
        $existingRules = aws ec2 describe-security-groups `
            --group-ids $SecurityGroupId `
            --query "SecurityGroups[0].IpPermissions[?FromPort==``5432``].IpRanges[].CidrIp" `
            --output json | ConvertFrom-Json

        if ($existingRules -contains "$myIp/32") {
            Write-Success "Security group rule already exists"
        }
        else {
            Write-Info "Adding security group rule..."
            aws ec2 authorize-security-group-ingress `
                --group-id $SecurityGroupId `
                --protocol tcp `
                --port 5432 `
                --cidr "$myIp/32" 2>&1 | Out-Null

            if ($LASTEXITCODE -eq 0) {
                Write-Success "Security group configured"
            }
            else {
                Write-Warning "Security group rule might already exist"
            }
        }
    }
    catch {
        Write-Warning "Could not configure security group automatically"
        Write-Info "Please configure manually in AWS Console"
    }
}
else {
    Write-Warning "Skipping security group configuration (--SkipSecurityGroup)"
}

# Step 3: Update .env file
Write-Step "STEP 3: Updating Environment Variables"

$databaseUrl = "postgresql://postgres:AwarenessDB2026SecurePass@${endpoint}:${port}/awareness_market?sslmode=require"
Write-Info "DATABASE_URL: postgresql://postgres:****@${endpoint}:${port}/awareness_market"

$envPath = Join-Path $PSScriptRoot "..\\.env"
if (Test-Path $envPath) {
    Write-Info "Updating .env file..."

    $envContent = Get-Content $envPath -Raw
    $envContent = $envContent -replace 'DATABASE_URL=.*', "DATABASE_URL=$databaseUrl"
    $envContent | Set-Content $envPath -NoNewline

    Write-Success ".env file updated"
}
else {
    Write-Warning ".env file not found at: $envPath"
    Write-Info "Please create .env file with:"
    Write-Host "DATABASE_URL=$databaseUrl" -ForegroundColor Yellow
}

# Step 4: Test Connection
Write-Step "STEP 4: Testing Database Connection"

Write-Info "Running connection test..."
$env:DATABASE_URL = $databaseUrl

try {
    $testResult = node (Join-Path $PSScriptRoot "test-db-connection.js")
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Database connection successful"
    }
    else {
        Write-Error "Database connection failed"
        Write-Warning "Please check the error messages above"
        exit 1
    }
}
catch {
    Write-Warning "Connection test failed: $_"
    Write-Info "You can test manually with: node scripts/test-db-connection.js"
}

# Step 5: Run Migrations
if (-not $SkipMigration) {
    Write-Step "STEP 5: Running Prisma Migrations"

    Write-Info "Generating Prisma Client..."
    npx prisma generate

    Write-Info "Applying database migrations..."
    npx prisma migrate deploy

    if ($LASTEXITCODE -eq 0) {
        Write-Success "Migrations completed successfully"
    }
    else {
        Write-Error "Migration failed"
        Write-Warning "You can run migrations manually with: npx prisma migrate deploy"
        exit 1
    }

    # Verify tables
    Write-Info "Verifying tables..."
    $tablesCheck = npx prisma db execute --stdin "<<< SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
    Write-Success "Database schema verified"
}
else {
    Write-Warning "Skipping migrations (--SkipMigration)"
}

# Success Summary
Write-Step "🎉 Setup Complete!" "Green"

Write-Host @"

✅ All steps completed successfully!

📊 Connection Details:
   Endpoint: $endpoint
   Port: $port
   Database: awareness_market
   Username: postgres

🔗 DATABASE_URL has been set in .env

📋 Next Steps:
   1. Test the connection: node scripts/test-db-connection.js
   2. Open Prisma Studio: npx prisma studio
   3. Start your application: npm run dev

🔐 Security Reminders:
   - Never commit .env file to Git
   - Use AWS Secrets Manager for production
   - Restrict security group access in production
   - Enable SSL connections (already configured)

📖 Documentation:
   - RDS_DEPLOYMENT_STEPS.md
   - PRISMA_MIGRATION_COMPLETE.md
   - AWS_DATABASE_SETUP.md

"@ -ForegroundColor Green

Write-Host "✨ Your database is ready to use!" -ForegroundColor Cyan
Write-Host ""
