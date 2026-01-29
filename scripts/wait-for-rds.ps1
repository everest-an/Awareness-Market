# Wait for RDS Instance to be Available
# Usage: .\scripts\wait-for-rds.ps1

$instanceId = "awareness-network-db"

Write-Host "🔍 Monitoring RDS instance: $instanceId" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop monitoring`n" -ForegroundColor Yellow

while ($true) {
    try {
        $result = aws rds describe-db-instances `
            --db-instance-identifier $instanceId `
            --query 'DBInstances[0].[DBInstanceStatus,Endpoint.Address,Endpoint.Port]' `
            --output json | ConvertFrom-Json

        $status = $result[0]
        $endpoint = $result[1]
        $port = $result[2]

        $timestamp = Get-Date -Format 'HH:mm:ss'

        if ($status -eq "available") {
            Write-Host "`n✅ Database is ready!" -ForegroundColor Green
            Write-Host "`nConnection Details:" -ForegroundColor Cyan
            Write-Host "  Endpoint: $endpoint" -ForegroundColor White
            Write-Host "  Port: $port" -ForegroundColor White
            Write-Host "  Database: awareness_market" -ForegroundColor White
            Write-Host "  Username: postgres" -ForegroundColor White

            Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
            Write-Host "1. Configure security group (allow your IP)" -ForegroundColor White
            Write-Host "2. Update DATABASE_URL in .env" -ForegroundColor White
            Write-Host "3. Run: npx prisma migrate deploy" -ForegroundColor White

            Write-Host "`n🔗 Your DATABASE_URL:" -ForegroundColor Cyan
            Write-Host "postgresql://postgres:AwarenessDB2026SecurePass@$endpoint`:$port/awareness_market?sslmode=require" -ForegroundColor Yellow

            break
        }
        elseif ($status -eq "creating" -or $status -eq "backing-up") {
            Write-Host "[$timestamp] ⏳ Status: $status (waiting...)" -ForegroundColor Yellow
        }
        elseif ($status -eq "failed") {
            Write-Host "`n❌ Instance creation failed!" -ForegroundColor Red
            Write-Host "Check AWS Console for details: https://console.aws.amazon.com/rds/" -ForegroundColor Yellow
            break
        }
        else {
            Write-Host "[$timestamp] 🔄 Status: $status" -ForegroundColor Cyan
        }

        Start-Sleep -Seconds 30
    }
    catch {
        Write-Host "❌ Error checking instance status: $_" -ForegroundColor Red
        Write-Host "Make sure AWS CLI is configured and you have permissions" -ForegroundColor Yellow
        break
    }
}

Write-Host "`n✨ Script completed" -ForegroundColor Green
