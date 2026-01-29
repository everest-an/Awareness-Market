# 代币经济学可视化图表

本文档包含白皮书Section 10.7-10.9的所有Mermaid图表代码。

---

## 图表1: 排放曲线 (Emission Curve)

### 流通供应曲线

```mermaid
%%{init: {'theme':'base', 'themeVariables': { 'primaryColor':'#4F46E5','primaryTextColor':'#fff','primaryBorderColor':'#312E81','lineColor':'#6366F1','secondaryColor':'#10B981','tertiaryColor':'#F59E0B'}}}%%
graph TD
    subgraph "Token Emission Timeline (10 Years)"
        Y0["Year 0<br/>100M tokens<br/>(10% circulating)"]
        Y2["Year 2<br/>280M tokens<br/>(28% circulating)"]
        Y4["Year 4<br/>520M tokens<br/>(52% circulating)"]
        Y6["Year 6<br/>720M tokens<br/>(72% circulating)"]
        Y8["Year 8<br/>860M tokens<br/>(86% circulating)"]
        Y10["Year 10<br/>950M tokens<br/>(95% circulating)"]

        Y0 -->|High emission| Y2
        Y2 -->|Halving #1| Y4
        Y4 -->|Halving #2| Y6
        Y6 -->|Halving #3| Y8
        Y8 -->|Tail emission| Y10

        style Y0 fill:#EF4444,stroke:#B91C1C,color:#fff
        style Y2 fill:#F59E0B,stroke:#D97706,color:#fff
        style Y4 fill:#FBBF24,stroke:#F59E0B,color:#000
        style Y6 fill:#84CC16,stroke:#65A30D,color:#000
        style Y8 fill:#10B981,stroke:#059669,color:#fff
        style Y10 fill:#06B6D4,stroke:#0891B2,color:#fff
    end
```

### 通胀率递减图

```mermaid
%%{init: {'theme':'base'}}%%
graph LR
    subgraph "Inflation Rate Over Time"
        E1["Epoch 1<br/>Months 0-24<br/>📈 80% APY"]
        E2["Epoch 2<br/>Months 25-48<br/>📊 40% APY"]
        E3["Epoch 3<br/>Months 49-72<br/>📉 20% APY"]
        E4["Epoch 4<br/>Months 73-96<br/>📉 10% APY"]
        E5["Epoch 5+<br/>Months 97+<br/>🔥 <5% APY"]

        E1 -.Halving.-> E2
        E2 -.Halving.-> E3
        E3 -.Halving.-> E4
        E4 -.Decay.-> E5

        style E1 fill:#DC2626,stroke:#991B1B,color:#fff
        style E2 fill:#EA580C,stroke:#C2410C,color:#fff
        style E3 fill:#F59E0B,stroke:#D97706,color:#fff
        style E4 fill:#84CC16,stroke:#65A30D,color:#000
        style E5 fill:#10B981,stroke:#059669,color:#fff
    end
```

---

## 图表2: 交易生命周期 (Transaction Lifecycle)

### 完整序列图

```mermaid
%%{init: {'theme':'base', 'themeVariables': {'actorBkg':'#4F46E5','actorTextColor':'#fff','actorLineColor':'#312E81','signalColor':'#6366F1','signalTextColor':'#1F2937','labelBoxBkgColor':'#EEF2FF','labelBoxBorderColor':'#4F46E5'}}}%%
sequenceDiagram
    autonumber

    participant User as 🤖 User Agent<br/>(AI Client)
    participant Router as 🔀 Protocol Router<br/>(Load Balancer)
    participant Relayer as ⚡ Relayer Node<br/>(GPU Miner)
    participant Watcher as 👁️ Watcher<br/>(Validator)
    participant Settlement as 💰 Settlement Layer<br/>(Smart Contract)

    Note over User: User has Llama-3 vector,<br/>needs Mistral conversion

    User->>Router: 1. Request Transformation<br/>+ Pay 100 $AMEM gas

    activate Router
    Note over Router: Find best Relayer with<br/>Llama-3→Mistral W-Matrix
    Router->>Relayer: 2. Route Request<br/>+ W-Matrix ID
    deactivate Router

    activate Relayer
    Note over Relayer: Execute:<br/>vector × W-Matrix<br/>= transformed_vector
    Relayer->>Watcher: 3. Submit Result<br/>+ Zero-Knowledge Proof
    deactivate Relayer

    activate Watcher
    Note over Watcher: Verify ZKP<br/>Check semantic anchors<br/>(no inference needed)
    Watcher->>Settlement: 4. Verification ✓<br/>Quality Score: 0.96
    deactivate Watcher

    activate Settlement
    Note over Settlement: Fee Distribution:<br/>30% → Burn 🔥<br/>15% → Relayer<br/>5% → Matrix Architect<br/>50% → Result delivery
    Settlement->>User: 5. Deliver Result<br/>+ Quality Metrics
    Settlement->>Relayer: 15 $AMEM (compute fee)
    Settlement->>Router: 5 $AMEM (IP royalty)
    deactivate Settlement

    Note over User,Settlement: Transaction Complete!<br/>Total time: ~200ms<br/>Cost: 100 $AMEM (~$0.001)
```

### 简化流程图

```mermaid
%%{init: {'theme':'forest'}}%%
flowchart TD
    Start([🤖 User Initiates Request]) --> Router{🔀 Protocol Router}

    Router -->|Find best<br/>Relayer| Relayer[⚡ Relayer Node<br/>Execute Transformation]

    Relayer -->|Submit result<br/>+ ZKP| Watcher{👁️ Watcher<br/>Verification}

    Watcher -->|✓ Valid| Settlement[💰 Settlement Layer]
    Watcher -->|✗ Invalid| Slash[🔨 Slash Relayer<br/>-50,000 $AMEM]

    Settlement --> Burn[🔥 Burn 30%<br/>30 $AMEM]
    Settlement --> RelayerFee[⚡ Relayer 15%<br/>15 $AMEM]
    Settlement --> RoyaltyFee[👨‍💻 Architect 5%<br/>5 $AMEM]
    Settlement --> Delivery[📦 Deliver to User<br/>50 $AMEM value]

    Delivery --> End([✅ Transaction Complete])
    Slash --> End

    style Start fill:#4F46E5,stroke:#312E81,color:#fff
    style Router fill:#06B6D4,stroke:#0891B2,color:#fff
    style Relayer fill:#8B5CF6,stroke:#6D28D9,color:#fff
    style Watcher fill:#F59E0B,stroke:#D97706,color:#fff
    style Settlement fill:#10B981,stroke:#059669,color:#fff
    style Burn fill:#EF4444,stroke:#B91C1C,color:#fff
    style End fill:#22C55E,stroke:#16A34A,color:#fff
    style Slash fill:#DC2626,stroke:#991B1B,color:#fff
```

---

## 图表3: 参与角色矩阵 (Participation Matrix)

### 4个角色关系图

```mermaid
%%{init: {'theme':'base'}}%%
graph TB
    subgraph "Awareness Network Roles"
        Architect[👨‍💻 Matrix Architect<br/>━━━━━━━━━━━━━━━<br/>Entry: Intellectual Capital<br/>Action: Train W-Matrix<br/>Revenue: Royalty Fees 💎]

        Relayer[⚡ Relayer Node<br/>━━━━━━━━━━━━━━━<br/>Entry: 24GB GPU + 50K $AMEM<br/>Action: Execute Transformations<br/>Revenue: Priority Fees + Block Rewards 💰]

        Watcher[👁️ Watcher<br/>━━━━━━━━━━━━━━━<br/>Entry: 5K $AMEM Stake<br/>Action: Verify with ZKP<br/>Revenue: Bounty Rewards 🎯]

        User[🤖 Agent Operator<br/>━━━━━━━━━━━━━━━<br/>Entry: $AMEM Balance<br/>Action: Use Network<br/>Revenue: N/A (Consumer) 🛍️]

        Architect -->|Uploads W-Matrix| Market[(🏪 Matrix Marketplace)]
        Market -->|Royalty 5%| Architect

        Relayer -->|Stakes 50K $AMEM| Network{🌐 Awareness Network}
        Network -->|Priority Fees 15%| Relayer

        Watcher -->|Stakes 5K $AMEM| Network
        Network -->|Bounties 50% slashed| Watcher

        User -->|Pays Gas| Network
        Network -->|Result| User

        Market -.W-Matrix.-> Relayer
        Network -->|30% Burn 🔥| Burn[💀 Deflationary]
    end

    style Architect fill:#8B5CF6,stroke:#6D28D9,color:#fff
    style Relayer fill:#06B6D4,stroke:#0891B2,color:#fff
    style Watcher fill:#F59E0B,stroke:#D97706,color:#fff
    style User fill:#10B981,stroke:#059669,color:#fff
    style Market fill:#EC4899,stroke:#BE185D,color:#fff
    style Network fill:#4F46E5,stroke:#312E81,color:#fff
    style Burn fill:#EF4444,stroke:#B91C1C,color:#fff
```

---

## 图表4: 协议自有流动性飞轮 (POL Flywheel)

### 正反馈循环

```mermaid
%%{init: {'theme':'base'}}%%
graph LR
    subgraph "Protocol-Owned Liquidity Flywheel"
        A[📈 More Transactions] -->|Generate| B[💰 Higher Fees]
        B -->|10% to| C[🏦 Treasury Grows]
        C -->|50% quarterly| D[🔄 Buyback $AMEM]
        D -->|Add to| E[💧 Liquidity Pools]
        E -->|Creates| F[📊 Price Support]
        F -->|Attracts| G[👥 More Users]
        G -->|Create| A

        style A fill:#10B981,stroke:#059669,color:#fff
        style B fill:#F59E0B,stroke:#D97706,color:#fff
        style C fill:#8B5CF6,stroke:#6D28D9,color:#fff
        style D fill:#EC4899,stroke:#BE185D,color:#fff
        style E fill:#06B6D4,stroke:#0891B2,color:#fff
        style F fill:#6366F1,stroke:#4F46E5,color:#fff
        style G fill:#22C55E,stroke:#16A34A,color:#fff
    end

    classDef highlight fill:#EF4444,stroke:#B91C1C,color:#fff
```

### 飞轮详细机制

```mermaid
%%{init: {'theme':'neutral'}}%%
flowchart TD
    Start([🚀 Network Launch]) --> Usage[User Activity<br/>AI Agents use network]

    Usage -->|Every transaction| Fee[Transaction Fee<br/>100 $AMEM]

    Fee --> Split{Fee Distribution}

    Split -->|30%| Burn[🔥 Burned<br/>30 $AMEM<br/>Reduces supply]
    Split -->|15%| Relayer[⚡ Relayer<br/>15 $AMEM<br/>Compute reward]
    Split -->|5%| Royalty[👨‍💻 Architect<br/>5 $AMEM<br/>IP royalty]
    Split -->|10%| Treasury[🏦 Treasury<br/>10 $AMEM<br/>Accumulates]
    Split -->|40%| Value[📦 Value Transfer<br/>40 $AMEM<br/>To recipient]

    Treasury -->|Quarterly| Decision{Treasury Action}

    Decision -->|50%| Buyback[💎 Buyback $AMEM<br/>from DEX]
    Decision -->|50%| Reserve[🏰 Reserve<br/>for emergencies]

    Buyback -->|Pair with USDC| LP[💧 Add Liquidity<br/>$AMEM-USDC pool]

    LP --> Support[📈 Price Support<br/>+ Deep liquidity]

    Support --> Attract[👥 Attract new users<br/>Lower slippage]

    Attract --> Usage

    Burn --> Supply[📉 Supply Reduction<br/>Deflationary pressure]
    Supply --> Support

    style Start fill:#4F46E5,stroke:#312E81,color:#fff
    style Burn fill:#EF4444,stroke:#B91C1C,color:#fff
    style Treasury fill:#8B5CF6,stroke:#6D28D9,color:#fff
    style Buyback fill:#EC4899,stroke:#BE185D,color:#fff
    style LP fill:#06B6D4,stroke:#0891B2,color:#fff
    style Support fill:#10B981,stroke:#059669,color:#fff
    style Supply fill:#F59E0B,stroke:#D97706,color:#fff
```

---

## 图表5: 治理护盾 (Governance Shield)

### 投票权曲线

```mermaid
%%{init: {'theme':'base'}}%%
graph TD
    subgraph "Vote-Escrowed $AMEM (ve$AMEM) Mechanism"
        Lock1["🔒 Lock 12 months<br/>━━━━━━━━━━━━━━━<br/>1.0x voting power"]
        Lock2["🔒 Lock 24 months<br/>━━━━━━━━━━━━━━━<br/>2.0x voting power"]
        Lock3["🔒 Lock 36 months<br/>━━━━━━━━━━━━━━━<br/>3.0x voting power"]
        Lock4["🔒 Lock 48 months<br/>━━━━━━━━━━━━━━━<br/>4.0x voting power ⭐"]

        User([Stake $AMEM]) --> Choice{Choose Lock Duration}

        Choice -->|12 months| Lock1
        Choice -->|24 months| Lock2
        Choice -->|36 months| Lock3
        Choice -->|48 months| Lock4

        Lock1 --> Vote1[Vote on Proposals<br/>Influence: ⭐]
        Lock2 --> Vote2[Vote on Proposals<br/>Influence: ⭐⭐]
        Lock3 --> Vote3[Vote on Proposals<br/>Influence: ⭐⭐⭐]
        Lock4 --> Vote4[Vote on Proposals<br/>Influence: ⭐⭐⭐⭐]

        Vote1 --> Cooldown[7-day Cooldown<br/>to unstake]
        Vote2 --> Cooldown
        Vote3 --> Cooldown
        Vote4 --> Cooldown

        Cooldown --> Penalty{Early Exit?}
        Penalty -->|Yes - Lose voting power| LosePower[❌ Immediate power loss]
        Penalty -->|No - Wait 7 days| Success[✅ Unlock $AMEM]

        style User fill:#4F46E5,stroke:#312E81,color:#fff
        style Lock1 fill:#84CC16,stroke:#65A30D,color:#000
        style Lock2 fill:#FBBF24,stroke:#F59E0B,color:#000
        style Lock3 fill:#F59E0B,stroke:#D97706,color:#fff
        style Lock4 fill:#DC2626,stroke:#991B1B,color:#fff
        style LosePower fill:#EF4444,stroke:#B91C1C,color:#fff
        style Success fill:#10B981,stroke:#059669,color:#fff
    end
```

### 投票权衰减机制

```mermaid
%%{init: {'theme':'base'}}%%
gantt
    title Vote-Escrowed $AMEM Power Decay
    dateFormat YYYY-MM-DD
    axisFormat %b %Y

    section Alice (48-month lock)
    4.0x power: active, 2026-01-01, 2030-01-01
    Gradual decay: crit, 2030-01-01, 2030-06-01
    0.0x power: done, 2030-06-01, 2030-07-01

    section Bob (24-month lock)
    2.0x power: active, 2026-01-01, 2028-01-01
    Gradual decay: crit, 2028-01-01, 2028-06-01
    0.0x power: done, 2028-06-01, 2028-07-01

    section Carol (12-month lock)
    1.0x power: active, 2026-01-01, 2027-01-01
    Gradual decay: crit, 2027-01-01, 2027-04-01
    0.0x power: done, 2027-04-01, 2027-05-01
```

---

## 图表6: 质押锁定增长 (Staking Lock-up Growth)

### 网络成长与供应锁定

```mermaid
%%{init: {'theme':'base'}}%%
graph LR
    subgraph "Network Growth Timeline"
        Stage1["📅 Launch<br/>━━━━━━━━━━<br/>100 Relayers<br/>5M $AMEM locked<br/>(0.5% supply)"]

        Stage2["📅 Year 1<br/>━━━━━━━━━━<br/>500 Relayers<br/>25M $AMEM locked<br/>(2.5% supply)"]

        Stage3["📅 Year 3<br/>━━━━━━━━━━<br/>1,000 Relayers<br/>50M $AMEM locked<br/>(5% supply)"]

        Stage4["📅 Year 5<br/>━━━━━━━━━━<br/>2,000 Relayers<br/>100M $AMEM locked<br/>(10% supply)"]

        Stage5["📅 Maturity<br/>━━━━━━━━━━<br/>5,000 Relayers<br/>250M $AMEM locked<br/>(25% supply) 🔒"]

        Stage1 --> Stage2
        Stage2 --> Stage3
        Stage3 --> Stage4
        Stage4 --> Stage5

        style Stage1 fill:#84CC16,stroke:#65A30D,color:#000
        style Stage2 fill:#FBBF24,stroke:#F59E0B,color:#000
        style Stage3 fill:#F59E0B,stroke:#D97706,color:#fff
        style Stage4 fill:#F97316,stroke:#EA580C,color:#fff
        style Stage5 fill:#DC2626,stroke:#991B1B,color:#fff
    end
```

---

## 使用说明

### 在GitHub/GitLab中查看
这些Mermaid图表可以直接在GitHub、GitLab、Notion等支持Mermaid的Markdown渲染器中查看。

### 在本地预览
使用以下工具预览Mermaid图表：
1. **VSCode**: 安装 "Markdown Preview Mermaid Support" 插件
2. **在线编辑器**: https://mermaid.live/
3. **命令行**: `npm install -g @mermaid-js/mermaid-cli`

### 导出为图片
```bash
# 安装mermaid-cli
npm install -g @mermaid-js/mermaid-cli

# 导出为PNG
mmdc -i TOKENOMICS_CHARTS.md -o emission-curve.png

# 导出为SVG（矢量图，推荐）
mmdc -i TOKENOMICS_CHARTS.md -o emission-curve.svg
```

### 嵌入到白皮书
将相应的Mermaid代码块直接复制到 `WHITEPAPER.md` 的对应章节，替换ASCII艺术。

---

**文档版本**: 1.0.0
**创建日期**: 2026-01-29
**作者**: Claude Sonnet 4.5
**更新日志**: 初始创建，包含6个主要图表
