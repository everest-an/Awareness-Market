# Demo Account Preparation Guide for Awareness Market

## Overview

This document outlines the requirements and steps for creating a demo account for OpenAI ChatGPT app submission review.

## Demo Account Requirements

According to OpenAI's submission guidelines, we must provide a fully-featured demo account with sample data for reviewers to test the application.

### Account Credentials

**Email**: demo@awareness.market  
**Password**: AwarenessDemo2026!  
**Account Type**: Full-featured account with all permissions  
**2FA**: Disabled (required for reviewer access)

## Sample Data Requirements

The demo account should include:

### 1. Memory Packages (KV-Cache)

- **Minimum**: 10 sample memory packages
- **Types**: Mix of free and premium packages
- **Models**: Various model pairs (GPT-4 → GPT-3.5, Claude → GPT, etc.)
- **Status**: Mix of published and draft packages
- **Data**: Realistic KV-cache data with proper metadata

### 2. Reasoning Chains

- **Minimum**: 5 sample reasoning chains
- **Categories**: Different problem types (math, logic, creative, etc.)
- **Complexity**: Range from simple to complex
- **Status**: Published and available for browsing

### 3. Long-term Memory (Interaction Memory)

- **Minimum**: 3 sample interaction memories
- **Types**: Conversation histories, user preferences, context data
- **Status**: Active and accessible

### 4. Purchase History

- **Transactions**: 5-10 sample purchase records
- **Types**: Mix of free downloads and paid purchases
- **Status**: Completed transactions with proper timestamps

### 5. User Profile

- **Name**: Demo User
- **Bio**: "Demo account for Awareness Market showcasing AI memory marketplace features"
- **Avatar**: Default or sample avatar
- **Joined Date**: Recent date
- **Activity**: Sample activity logs

## Screenshot Requirements

For OpenAI submission, we need 3-5 high-quality screenshots showing:

### Screenshot 1: Memory Browsing Interface
- Show the main marketplace with multiple memory packages
- Display filters and search functionality
- Highlight different memory types (KV-cache, reasoning chain, long-term)

### Screenshot 2: Model Compatibility Checking
- Show the W-Matrix alignment interface
- Display compatibility scores between models
- Highlight the three memory types integration

### Screenshot 3: Memory Package Details
- Show detailed view of a memory package
- Display metadata, performance metrics, and pricing
- Show download/purchase options

### Screenshot 4: Three Memory Types in Action
- Show all three memory types (KV-cache, reasoning chain, long-term memory)
- Display how they work together
- Highlight the unique features of each type

### Screenshot 5: MCP Integration in ChatGPT (Optional)
- Show the app running in ChatGPT
- Display MCP tool calls
- Highlight discovery and information features

## Setup Steps

### Step 1: Create Demo Account

```bash
# Run the registration script
cd /home/ubuntu/Awareness-Market
pnpm run create-demo-account
```

### Step 2: Seed Sample Data

```bash
# Run the data seeding script
pnpm run seed-demo-data
```

### Step 3: Verify Account

- Log in with demo credentials
- Verify all features are accessible
- Check that sample data is properly displayed
- Test all three memory types
- Verify purchase history

### Step 4: Take Screenshots

- Use browser at 1920x1080 resolution
- Capture screenshots in PNG format
- Ensure UI is clean and professional
- Highlight key features in each screenshot

### Step 5: Document Credentials

- Save credentials in secure location
- Prepare submission form with demo account info
- Include any special instructions for reviewers

## Testing Checklist

Before submission, verify the demo account can:

- [ ] Log in successfully without 2FA
- [ ] Browse memory marketplace
- [ ] View memory package details
- [ ] Check model compatibility
- [ ] Search for memories
- [ ] Filter by memory type
- [ ] View purchase history
- [ ] Access all three memory types
- [ ] See performance metrics
- [ ] View W-Matrix alignment data

## Notes for Reviewers

Include these notes in the submission:

1. **Account Purpose**: This is a fully-featured demo account with sample data for review purposes.

2. **Sample Data**: All data in this account is synthetic and for demonstration purposes only.

3. **Features**: The account has access to all features available on the website, including:
   - Memory browsing and discovery
   - Model compatibility checking
   - Three memory types (KV-cache, reasoning chain, long-term memory)
   - W-Matrix alignment visualization
   - Purchase history

4. **OpenAI Integration**: The OpenAI ChatGPT app provides free discovery and information features, allowing users to browse and learn about memories before visiting the website for purchases.

5. **No Payment Required**: The demo account includes sample purchase history, but no actual payment processing is required for testing.

## Security Considerations

- Demo account password should be strong but shareable
- Account should have limited permissions (no admin access)
- Sample data should not contain any real user information
- Account should be monitored for unusual activity
- Account can be reset or disabled after review period

## Maintenance

- Review demo account monthly
- Update sample data to reflect new features
- Ensure demo account stays in sync with production features
- Monitor for any issues or errors
