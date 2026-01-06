# Memory Provenance Visualization Guide

## Overview

The Memory Provenance feature provides a visual representation of AI memory derivation chains, showing how memories evolve, fork, and contribute to each other over time. This creates a transparent, auditable history of AI knowledge transfer with automatic royalty distribution.

---

## Key Features

### 1. **Interactive Family Tree**
- Horizontal tree layout showing parent-child relationships
- Color-coded nodes by quality grade (green/blue/orange)
- Expandable/collapsible branches
- Zoom and pan controls

### 2. **Royalty Flow Visualization**
- Orange dots indicate royalty payments
- Percentage-based revenue sharing
- Multi-level royalty distribution
- Cumulative royalty tracking

### 3. **Node Details Panel**
- Creator information
- Creation date and epsilon value
- Price and download statistics
- Royalty share percentage
- Direct link to memory detail page

### 4. **Navigation**
- Full-screen mode for large trees
- Click nodes to view details
- Hover for quick info
- Breadcrumb navigation

---

## How to Access

### From Memory Marketplace
1. Browse memories at `/memory-marketplace`
2. Look for memories with "View Provenance" link
3. Click to see the full derivation tree

### From Memory Detail Page
1. Visit any memory detail page (`/memory/:id`)
2. Click "View Provenance Tree" button in sidebar
3. Explore the family tree

### Direct URL
- Navigate to `/memory-provenance/:memoryId`
- Replace `:memoryId` with the actual memory NFT ID

---

## Understanding the Tree

### Node Colors
- **Green**: Excellent quality (epsilon < 3%)
- **Blue**: Good quality (epsilon 3-5%)
- **Orange**: Fair quality (epsilon > 5%)

### Royalty Indicators
- **Orange Dots**: Royalty payment flow
- **Percentage**: Share of revenue going to parent
- **Cumulative**: Total royalties paid over time

### Tree Structure
```
Original Memory (Root)
├── Derived Memory A (30% royalty to root)
│   ├── Optimized A1 (30% to A, 21% to root)
│   └── Specialized A2 (30% to A, 21% to root)
└── Derived Memory B (30% royalty to root)
    └── Mobile B1 (30% to B, 21% to root)
```

---

## Royalty Calculation

### Single-Level Royalty
- **Parent receives**: 30% of sale price (default)
- **Creator keeps**: 70% of sale price

### Multi-Level Royalty
When a memory is derived from a derived memory:
- **Immediate parent**: 30% of sale price
- **Grandparent**: 30% of parent's share = 9% of sale price
- **Great-grandparent**: 30% of grandparent's share = 2.7% of sale price

### Example
If Memory C (derived from B, which is derived from A) sells for $100:
- **C's creator**: $70
- **B's creator**: $30
- **A's creator**: $9 (30% of B's $30)
- **Total distributed**: $109 (platform covers the difference)

---

## Use Cases

### 1. **Verify Memory Authenticity**
- Check if a memory claims to be derived from a reputable source
- Verify the derivation chain is legitimate
- See the quality progression over generations

### 2. **Track Royalty Earnings**
- See all memories derived from your creations
- Calculate potential passive income
- Monitor usage and popularity

### 3. **Discover Related Memories**
- Find improved versions of memories you own
- Explore alternative derivations
- Identify trending derivation paths

### 4. **Research Memory Evolution**
- Study how AI capabilities improve over time
- Analyze quality trends across generations
- Identify successful optimization strategies

---

## Technical Details

### Data Structure
```typescript
interface MemoryNode {
  id: string;
  title: string;
  creator: string;
  createdAt: string;
  epsilon: number;
  price: number;
  downloads: number;
  royaltyShare: number; // Percentage (0-100)
  children?: MemoryNode[];
}
```

### API Endpoint
```typescript
// tRPC procedure
memoryNFT.getProvenance.useQuery({ memoryId: string })

// Returns hierarchical tree structure
```

### Visualization Library
- **D3.js v7.9.0**: Tree layout and rendering
- **React**: Component framework
- **Tailwind CSS**: Styling

---

## Best Practices

### For Creators
1. **Document Derivations**: Clearly describe what changed from parent
2. **Maintain Quality**: Aim for lower epsilon than parent
3. **Fair Pricing**: Consider parent's price + your improvements
4. **Attribution**: Credit parent creators in description

### For Consumers
1. **Check Provenance**: Verify derivation claims
2. **Compare Versions**: Use tree to find best value
3. **Support Original Creators**: Understand royalty flow
4. **Report Fraud**: Flag suspicious derivation claims

---

## Troubleshooting

### Tree Not Loading
- **Check memory ID**: Ensure it's a valid NFT ID
- **Network issues**: Refresh the page
- **No provenance**: Memory might be original (no parent)

### Missing Nodes
- **Privacy settings**: Some creators hide derivation info
- **Deleted memories**: Parent might have been removed
- **Data sync**: Wait a few seconds for blockchain sync

### Incorrect Royalties
- **Blockchain delay**: Royalties update every 24 hours
- **Rounding errors**: Small discrepancies are normal
- **Contact support**: Report significant issues

---

## Future Enhancements

### Planned Features
- [ ] Export tree as image (PNG/SVG)
- [ ] Filter by creator or date range
- [ ] Search within tree
- [ ] Compare multiple trees side-by-side
- [ ] Animated royalty flow visualization
- [ ] Real-time royalty updates
- [ ] Mobile-optimized touch controls

### Community Requests
- [ ] Show memory usage statistics in tree
- [ ] Highlight "hot" derivation paths
- [ ] Integration with blockchain explorers
- [ ] Derivation suggestions based on tree analysis

---

## Examples

### Example 1: Simple Derivation
```
GPT-3.5 → GPT-4 Original
└── GPT-3.5 → GPT-4 Enhanced (Fine-tuned for medical domain)
```

### Example 2: Complex Tree
```
LLaMA-3 Base
├── LLaMA-3 Code (Optimized for programming)
│   ├── LLaMA-3 Python (Specialized for Python)
│   └── LLaMA-3 JavaScript (Specialized for JS)
└── LLaMA-3 Chat (Fine-tuned for conversation)
    └── LLaMA-3 Support (Customer support specialist)
```

### Example 3: Merge Derivation
```
Claude-3 Sonnet + GPT-4
└── Hybrid Model (Best of both worlds)
```

---

## Resources

- **API Documentation**: `/api-docs`
- **Smart Contract**: [View on PolygonScan](https://polygonscan.com/)
- **Whitepaper**: `docs/WHITEPAPER_COMPLETE.md`
- **Support**: https://help.awareness.market

---

## FAQ

**Q: Can I hide my memory's provenance?**  
A: No, provenance is immutable and public for transparency.

**Q: How are royalties enforced?**  
A: Smart contracts automatically distribute royalties on every sale.

**Q: Can I derive from multiple parents?**  
A: Currently limited to single parent, multi-parent support coming soon.

**Q: What if my parent memory is deleted?**  
A: Your memory remains valid, but provenance link shows "Parent Unavailable".

**Q: How deep can derivation chains go?**  
A: No limit, but royalty percentages decrease exponentially.

---

## Glossary

- **Provenance**: The origin and history of a memory
- **Derivation**: Creating a new memory based on an existing one
- **Royalty**: Percentage of revenue shared with parent creators
- **Epsilon**: Quality metric (lower is better)
- **Family Tree**: Visual representation of derivation chain
- **Node**: Individual memory in the tree
- **Branch**: Path of derivations from a parent

---

*Last updated: 2026-01-06*  
*Version: 1.0.0*
