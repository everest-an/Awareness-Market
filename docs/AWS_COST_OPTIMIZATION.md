# AWS Cost Optimization Plan

## Current Monthly Cost: ~$382.15

| Resource | Monthly Cost | % of Total |
|----------|-------------|------------|
| RDS (db.c6gd.medium Multi-AZ MySQL + db.t3.micro PostgreSQL) | $220.89 | 57.8% |
| EC2 + EBS (t3.medium Virginia + t3.micro Ohio) | $132.09 | 34.6% |
| Public IPv4 (~9 addresses) | $27.90 | 7.3% |
| S3, Data Transfer, Secrets Manager | <$2.00 | <0.5% |

---

## Problem Analysis

### 1. Unused MySQL Instance ($147+ waste)
Your code uses **PostgreSQL only** (Prisma + `DATABASE_URL=postgresql://...`). The `db.c6gd.medium Multi-AZ MySQL` instance is completely unused — pure waste of $147+/month.

### 2. Multi-AZ on PostgreSQL (unnecessary for testing)
Multi-AZ doubles RDS cost by maintaining a standby replica. Zero benefit during testing.

### 3. Dual-Region EC2 (Ohio instance is redundant)
Only Virginia (`34.225.237.85`) is used for deployment. The Ohio `t3.micro` serves no purpose.

### 4. 9 Public IPv4 Addresses ($27.90 waste)
You only need 1 (the EC2 instance). The other ~8 are from unused resources (load balancers, NAT gateways, idle Elastic IPs).

---

## Action Plan

### Phase 1: Immediate Cleanup (saves ~$250/month)

#### 1.1 Delete Unused MySQL Instance
```
AWS Console → RDS → Instances → select MySQL instance → Actions → Delete
- Skip final snapshot (it's unused)
- Savings: ~$147/month
```

#### 1.2 Disable Multi-AZ on PostgreSQL
```
AWS Console → RDS → Instances → select PostgreSQL instance
→ Modify → Multi-AZ deployment: No → Apply immediately
- Savings: ~$10/month (halves the t3.micro cost)
```

#### 1.3 Reduce PostgreSQL Storage to 20GB
```
AWS Console → RDS → Instances → Modify
→ Storage: 20 GB gp3 (from 170GB+)
- Note: RDS storage can only be increased, not decreased.
  If current instance has 170GB allocated, create a new instance
  with 20GB, migrate data via pg_dump/pg_restore, then delete old.
- Savings: ~$12/month on storage
```

#### 1.4 Terminate Ohio EC2 Instance
```
AWS Console → EC2 → Instances (switch to us-east-2/Ohio)
→ select t3.micro → Instance State → Terminate
- Also delete its EBS volume and release Elastic IP
- Savings: ~$11/month
```

#### 1.5 Release Unused Public IPv4 Addresses
```
AWS Console → EC2 → Elastic IPs → release all unused
AWS Console → VPC → NAT Gateways → delete unused
AWS Console → EC2 → Load Balancers → delete unused
- Keep only 1 IP (the one attached to 34.225.237.85)
- Savings: ~$24/month
```

**Phase 1 Total Savings: ~$204/month**

---

### Phase 2: Right-Size Remaining Resources (saves ~$80/month)

#### 2.1 Downgrade EC2 from t3.medium to t3.small
Current: `t3.medium` (2 vCPU, 4GB RAM) = $0.0416/hr = $30/month
Target:  `t3.small` (2 vCPU, 2GB RAM) = $0.0208/hr = $15/month

Your PM2 config sets max memory to 1GB per process. A t3.small with 2GB RAM
is sufficient for testing with 1-2 PM2 instances.

```bash
# Steps:
1. Stop EC2 instance
2. Change instance type to t3.small
3. Start instance
4. Update PM2: PM2_INSTANCES=2 (not 'max')
```
**Savings: ~$15/month**

#### 2.2 Downgrade RDS PostgreSQL to db.t4g.micro
Current: `db.t3.micro` = $0.018/hr
Target:  `db.t4g.micro` = $0.016/hr (ARM, slightly cheaper + free tier eligible)

If within first 12 months of AWS account, db.t4g.micro is **free** (750 hrs/month).

```
AWS Console → RDS → Modify → Instance class: db.t4g.micro
```
**Savings: $2-13/month (free tier = $13 savings)**

#### 2.3 Reduce EBS Volume Size
Current: ~100GB gp3 across regions
Target: 20GB gp3 (Virginia only)

```bash
# Create snapshot of current volume, then:
# 1. Create new 20GB gp3 volume from snapshot
# 2. Attach new volume, detach old
# 3. Delete old volume
```
**Savings: ~$6/month**

#### 2.4 Use Scheduled Stop/Start for EC2
For testing, the server doesn't need to run 24/7.
Add an AWS Lambda or EventBridge rule to stop EC2 at night (e.g., 11PM-8AM = 9hrs off).

```
Running hours: 15hr/day × 30 = 450 hrs (vs 720 hrs)
Savings: 37.5% on EC2 compute
```
**Savings: ~$5-10/month**

**Phase 2 Total Savings: ~$28-44/month**

---

### Phase 3: Architecture Optimization (optional, saves more)

#### 3.1 Replace RDS with EC2-hosted PostgreSQL
Run PostgreSQL directly on your EC2 instance instead of managed RDS.
Eliminates RDS cost entirely (~$13-25/month savings).

```bash
# On EC2:
sudo amazon-linux-extras install postgresql15
sudo systemctl start postgresql
# Update DATABASE_URL to localhost
```
**Savings: $13-25/month (eliminates RDS)**
**Trade-off: No automated backups, you manage PostgreSQL yourself**

#### 3.2 Use Neon or Supabase Free Tier
Both offer free PostgreSQL hosting:
- **Neon**: 0.5GB storage, 190 compute hours/month, autoscaling
- **Supabase**: 500MB database, 2 projects free

For testing, either is sufficient and eliminates RDS cost completely.

#### 3.3 Switch to Graviton (ARM) Instance
`t4g.small` is ~20% cheaper than `t3.small` for equivalent performance.
Requires ARM-compatible Node.js (already supported).

---

## Projected Monthly Cost After Optimization

| Phase | Action | Before | After |
|-------|--------|--------|-------|
| 1.1 | Delete MySQL | $147 | $0 |
| 1.2 | Disable Multi-AZ | $10 | $0 |
| 1.3 | Reduce storage | $12 | $0 (via new instance) |
| 1.4 | Terminate Ohio EC2 | $11 | $0 |
| 1.5 | Release IPv4s | $24 | $3.6 (keep 1) |
| 2.1 | Downgrade EC2 | $30 | $15 |
| 2.2 | Downgrade RDS | $13 | $0 (free tier) |
| 2.3 | Reduce EBS | $8.6 | $1.6 |
| 2.4 | Scheduled stop | — | -$5 |
| — | S3 + misc | $2 | $2 |
| **Total** | | **$382** | **~$17-35/month** |

**Total savings: $347-365/month (90-95% reduction)**

---

## Execution Priority

```
Day 1 (5 min each):
  ✅ Delete unused MySQL RDS instance        → saves $147
  ✅ Release unused Elastic IPs              → saves $24
  ✅ Terminate Ohio EC2 instance             → saves $11

Day 2 (30 min):
  ✅ Disable Multi-AZ on PostgreSQL          → saves $10
  ✅ Downgrade EC2 to t3.small               → saves $15

Day 3 (optional, 1 hour):
  ✅ Migrate to db.t4g.micro                 → saves $13
  ✅ Reduce EBS to 20GB                      → saves $6

Total time: ~2 hours
Total savings: ~$226-350/month
```

---

## About the 30% Discount

The promised 30% discount likely applies only to EC2 compute (Savings Plans or Reserved Instances).
Even at 30% off the full bill: $382 × 0.7 = $267 — still expensive for testing.

**Action items:**
1. Check `AWS Console → Billing → Savings Plans` for active plans
2. Check `AWS Console → Billing → Reservations` for reserved instances
3. Contact the discount provider with your AWS Account ID to verify binding
4. Ask specifically: does the discount cover RDS, EBS, IPv4, or just EC2?
