# Hybrid Storage Solution - Cost Optimization for AI Uploads

## Overview

This document describes the hybrid storage architecture that separates AI agent uploads from user uploads, reducing storage costs by up to **62%**.

**Date**: 2026-01-06  
**Version**: 1.0.0  
**Status**: Ready for Deployment

---

## Problem Statement

Current architecture stores all files in AWS S3, which is expensive for AI agent uploads that:
- Are uploaded frequently (high volume)
- Are downloaded frequently (high egress)
- Don't require ultra-high availability (can tolerate slight latency)

**Current Cost** (all S3):
- Storage: $0.023/GB/month
- Egress: $0.09/GB
- **Total for 1TB + 500GB egress: $68/month**

---

## Solution: Multi-Backend Storage

### Architecture

```
┌─────────────────┐
│   Upload API    │
│                 │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Storage Router  │ ← Routing Logic
│                 │
└────┬───┬───┬────┘
     │   │   │
     v   v   v
   ┌───┐ ┌───┐ ┌───┐
   │S3 │ │R2 │ │B2 │
   └───┘ └───┘ └───┘
   User  AI    Large
   Upload Agent Files
```

### Backend Comparison

| Backend | Storage Cost | Egress Cost | Best For | Availability |
|---------|-------------|-------------|----------|--------------|
| **AWS S3** | $0.023/GB/mo | $0.09/GB | User uploads | 99.99% |
| **Cloudflare R2** | $0.015/GB/mo | **$0/GB** | AI uploads | 99.9% |
| **Backblaze B2** | $0.005/GB/mo | $0.01/GB* | Large files | 99.9% |

*First 3x storage egress is free

---

## Routing Rules

### 1. AI Agent Uploads → Cloudflare R2
- **Reason**: Zero egress fees, lower storage cost
- **Savings**: 56% vs S3
- **Trade-off**: Slightly lower availability (99.9% vs 99.99%)

### 2. Large Files (>100MB) → Backblaze B2
- **Reason**: Cheapest storage ($0.005/GB)
- **Savings**: 62% vs S3
- **Trade-off**: Egress fees apply (but still cheaper overall)

### 3. User Uploads → AWS S3
- **Reason**: Highest availability, best performance
- **Priority**: User experience over cost

### 4. Test/Development → Local or S3
- **Reason**: Easy debugging, no production impact

---

## Implementation

### File Structure

```
server/storage/
├── storage-backend.ts       # Interface definition
├── s3-backend.ts            # AWS S3 implementation
├── r2-backend.ts            # Cloudflare R2 implementation
├── b2-backend.ts            # Backblaze B2 implementation
├── storage-router.ts        # Routing logic
└── unified-storage.ts       # Unified API
```

### Usage Example

```typescript
import { storagePutSmart } from './storage/unified-storage';

// AI Agent upload - automatically routed to R2
const result = await storagePutSmart(
  'packages/vector/123/package.pkg',
  fileBuffer,
  'application/octet-stream',
  {
    uploadSource: 'ai_agent',
    packageType: 'vector',
    fileSize: fileBuffer.length,
    userId: 123,
  }
);

console.log(`Stored in ${result.backend}`); // "R2"
console.log(`Estimated cost: $${result.estimatedCost}/month`);
```

### Environment Variables

```bash
# Cloudflare R2 (recommended for AI uploads)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=awareness-ai-uploads
R2_PUBLIC_URL=https://cdn.awareness.market  # Optional: custom domain

# Backblaze B2 (optional, for large files)
B2_KEY_ID=your_key_id
B2_APPLICATION_KEY=your_app_key
B2_ENDPOINT=s3.us-west-004.backblazeb2.com
B2_BUCKET_NAME=awareness-ai-large-files
B2_PUBLIC_URL=https://f004.backblazeb2.com/file/awareness-ai-large-files

# Storage routing configuration
STORAGE_LARGE_FILE_THRESHOLD=104857600  # 100MB in bytes
```

---

## Cost Analysis

### Scenario 1: Typical Usage

**Assumptions**:
- Total storage: 1TB
- AI uploads: 80% (800GB)
- User uploads: 20% (200GB)
- Monthly downloads: 500GB
- AI downloads: 70% (350GB)

**Current Cost (all S3)**:
```
Storage: 1000GB × $0.023 = $23.00
Egress:  500GB  × $0.09  = $45.00
Total:                     $68.00/month
```

**Optimized Cost (AI → R2)**:
```
S3 Storage:  200GB × $0.023 = $4.60
S3 Egress:   150GB × $0.09  = $13.50
R2 Storage:  800GB × $0.015 = $12.00
R2 Egress:   350GB × $0     = $0.00
Total:                        $30.10/month

Savings: $37.90/month (56%)
```

**Optimized Cost (AI → B2)**:
```
S3 Storage:  200GB × $0.023 = $4.60
S3 Egress:   150GB × $0.09  = $13.50
B2 Storage:  800GB × $0.005 = $4.00
B2 Egress:   350GB × $0.01  = $3.50
Total:                        $25.60/month

Savings: $42.40/month (62%)
```

### Scenario 2: High AI Volume

**Assumptions**:
- Total storage: 5TB
- AI uploads: 90% (4.5TB)
- Monthly downloads: 2TB
- AI downloads: 80% (1.6TB)

**Current Cost (all S3)**:
```
Storage: 5000GB × $0.023 = $115.00
Egress:  2000GB × $0.09  = $180.00
Total:                     $295.00/month
```

**Optimized Cost (AI → R2)**:
```
S3 Storage:  500GB  × $0.023 = $11.50
S3 Egress:   400GB  × $0.09  = $36.00
R2 Storage:  4500GB × $0.015 = $67.50
R2 Egress:   1600GB × $0     = $0.00
Total:                         $115.00/month

Savings: $180.00/month (61%)
```

**Annual Savings**: $2,160

---

## Migration Strategy

### Phase 1: New Uploads (Immediate)
1. Deploy hybrid storage code
2. Configure R2 credentials
3. All new AI uploads go to R2
4. Monitor for 1 week

### Phase 2: Historical Data (Gradual)
1. Identify AI-uploaded files in S3
2. Migrate in batches (1000 files/day)
3. Update database URLs
4. Verify integrity
5. Delete S3 copies after 30 days

### Phase 3: Optimization (Ongoing)
1. Monitor access patterns
2. Move cold data to B2 (90+ days no access)
3. Keep hot data in R2/S3
4. Adjust thresholds based on usage

---

## Monitoring & Alerts

### Health Checks

```typescript
import { storageHealthCheck } from './storage/unified-storage';

// Check all backends
const health = await storageHealthCheck();
console.log(health);
// { s3: true, r2: true, b2: true }
```

### Cost Tracking

```typescript
import { getStorageCostComparison } from './storage/unified-storage';

// Compare costs for a 500MB file with 10 downloads/month
const comparison = getStorageCostComparison(500 * 1024 * 1024, 10);
console.log(comparison);
/*
[
  { backend: 'b2', storageCost: 0.0024, bandwidthCost: 0.0476, totalCost: 0.0500 },
  { backend: 'r2', storageCost: 0.0073, bandwidthCost: 0.0000, totalCost: 0.0073 },
  { backend: 's3', storageCost: 0.0112, bandwidthCost: 0.4286, totalCost: 0.4398 }
]
*/
```

### Alerts

- **Backend Unavailable**: Switch to fallback (S3)
- **Cost Spike**: Alert if monthly cost >20% above forecast
- **Slow Upload**: Alert if upload takes >2x expected time

---

## Deployment Checklist

### Prerequisites
- [ ] Cloudflare account with R2 enabled
- [ ] R2 bucket created: `awareness-ai-uploads`
- [ ] R2 API tokens generated
- [ ] (Optional) Backblaze B2 account and bucket

### Deployment Steps

1. **Set Environment Variables**
   ```bash
   # On EC2
   export R2_ACCOUNT_ID=xxx
   export R2_ACCESS_KEY_ID=xxx
   export R2_SECRET_ACCESS_KEY=xxx
   export R2_BUCKET_NAME=awareness-ai-uploads
   ```

2. **Test Backend Connectivity**
   ```bash
   curl https://awareness.market/api/storage/health
   ```

3. **Deploy Code**
   ```bash
   cd /var/www/awareness
   git pull
   pnpm install
   pm2 restart awareness
   ```

4. **Verify Routing**
   - Upload test file via AI Agent API
   - Check logs for "Routing to R2"
   - Verify file accessible via returned URL

5. **Monitor for 24 Hours**
   - Check error rates
   - Verify download speeds
   - Monitor cost metrics

### Rollback Plan

If issues occur:
1. Set `STORAGE_AI_BACKEND=s3` in environment
2. Restart server: `pm2 restart awareness`
3. All uploads will go to S3 (original behavior)

---

## FAQ

### Q: What happens if R2 is down?
**A**: The router automatically falls back to S3. No user-facing errors.

### Q: Can users choose their storage backend?
**A**: Not currently. Routing is automatic based on upload source. Advanced users could be given this option in the future.

### Q: How do we handle existing S3 files?
**A**: They stay in S3 until migrated. Downloads work from any backend.

### Q: What about CDN caching?
**A**: R2 has built-in CDN. For S3, use CloudFront (separate optimization).

### Q: Is R2 GDPR compliant?
**A**: Yes, Cloudflare R2 is GDPR compliant. Data can be stored in EU regions.

### Q: Can we use multiple R2 buckets?
**A**: Yes, modify `R2Backend` to accept bucket name as parameter.

---

## Performance Comparison

### Upload Speed
- S3: ~50 MB/s (US East)
- R2: ~40 MB/s (Global)
- B2: ~30 MB/s (US West)

### Download Speed (with CDN)
- S3 + CloudFront: ~100 MB/s
- R2 (built-in CDN): ~80 MB/s
- B2 + CDN: ~60 MB/s

### Latency (from US East)
- S3: 10-20ms
- R2: 20-30ms
- B2: 30-50ms

**Conclusion**: R2 offers the best cost/performance ratio for AI uploads.

---

## Future Enhancements

1. **Automatic Tiering**
   - Hot data (accessed in last 30 days) → R2
   - Warm data (30-90 days) → B2
   - Cold data (90+ days) → Glacier

2. **Multi-Region Support**
   - EU users → R2 EU bucket
   - Asia users → R2 Asia bucket
   - Reduce latency globally

3. **Compression**
   - Compress packages before upload
   - Save 30-50% storage cost
   - Transparent decompression on download

4. **Deduplication**
   - Hash-based deduplication
   - Store identical files once
   - Save 20-40% for similar packages

---

## Conclusion

The hybrid storage solution provides:
- ✅ **56-62% cost savings** for AI-heavy workloads
- ✅ **Zero code changes** for existing upload logic
- ✅ **Automatic routing** based on upload source
- ✅ **Graceful fallback** if backends unavailable
- ✅ **Easy monitoring** with built-in cost tracking

**Recommended**: Start with R2 for AI uploads. Add B2 later if needed for large files.

**Next Steps**:
1. Set up Cloudflare R2 account
2. Configure environment variables
3. Deploy hybrid storage code
4. Monitor for 1 week
5. Migrate historical data

**Questions?** Contact the infrastructure team.
