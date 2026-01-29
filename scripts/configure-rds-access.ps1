# Configure RDS Security Group for Access
# Usage: .\scripts\configure-rds-access.ps1

$securityGroupId = "sg-0a49a80bda988ee00"

Write-Host "🔐 Configuring RDS Security Group Access" -ForegroundColor Cyan
Write-Host "Security Group: $securityGroupId`n" -ForegroundColor White

# Get your public IP
Write-Host "🌐 Getting your public IP address..." -ForegroundColor Yellow
try {
    $myIp = (Invoke-WebRequest -Uri "https://checkip.amazonaws.com" -UseBasicParsing).Content.Trim()
    Write-Host "✅ Your IP: $myIp`n" -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to get public IP: $_" -ForegroundColor Red
    Write-Host "Please enter your IP manually:" -ForegroundColor Yellow
    $myIp = Read-Host "Your IP address"
}

# Check if rule already exists
Write-Host "🔍 Checking existing rules..." -ForegroundColor Yellow
try {
    $existingRules = aws ec2 describe-security-groups `
        --group-ids $securityGroupId `
        --query "SecurityGroups[0].IpPermissions[?FromPort==``5432``].IpRanges[].CidrIp" `
        --output json | ConvertFrom-Json

    if ($existingRules -contains "$myIp/32") {
        Write-Host "✅ Rule already exists for your IP!" -ForegroundColor Green
        Write-Host "No changes needed.`n" -ForegroundColor White
    }
    else {
        Write-Host "📝 Adding ingress rule for PostgreSQL (port 5432)..." -ForegroundColor Yellow

        aws ec2 authorize-security-group-ingress `
            --group-id $securityGroupId `
            --protocol tcp `
            --port 5432 `
            --cidr "$myIp/32" `
            --group-name "PostgreSQL access from $myIp" 2>&1 | Out-Null

        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Security group configured successfully!`n" -ForegroundColor Green
        }
        else {
            Write-Host "⚠️  Rule might already exist or permissions issue" -ForegroundColor Yellow
        }
    }
}
catch {
    Write-Host "❌ Error configuring security group: $_" -ForegroundColor Red
    Write-Host "`nManual steps:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://console.aws.amazon.com/ec2/v2/home#SecurityGroups:" -ForegroundColor White
    Write-Host "2. Find security group: $securityGroupId" -ForegroundColor White
    Write-Host "3. Add Inbound Rule:" -ForegroundColor White
    Write-Host "   - Type: PostgreSQL" -ForegroundColor White
    Write-Host "   - Port: 5432" -ForegroundColor White
    Write-Host "   - Source: My IP ($myIp/32)" -ForegroundColor White
    exit 1
}

# Display current rules
Write-Host "📋 Current PostgreSQL Rules:" -ForegroundColor Cyan
aws ec2 describe-security-groups `
    --group-ids $securityGroupId `
    --query "SecurityGroups[0].IpPermissions[?FromPort==``5432``]" `
    --output table

Write-Host "`n✅ Configuration complete!" -ForegroundColor Green
Write-Host "You can now connect to the database from your IP: $myIp" -ForegroundColor White
