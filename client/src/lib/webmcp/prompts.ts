/**
 * WebMCP Prompts for Awareness Market
 *
 * Defines reusable prompt templates for common AI queries
 */

export interface MCPPrompt {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
    default?: string;
  }>;
  template: string;
}

/**
 * Prompt 1: search_by_capability
 * Search for vectors by specific capability
 */
const searchByCapabilityPrompt: MCPPrompt = {
  name: 'search_by_capability',
  description: 'Search for latent vectors by specific capability or use case',
  arguments: [
    {
      name: 'capability',
      description: 'Desired capability (e.g., "image classification", "sentiment analysis", "code generation")',
      required: true,
    },
    {
      name: 'budget',
      description: 'Optional budget constraint (e.g., "$0.001 per call")',
      required: false,
    },
  ],
  template: `Find latent vectors in Awareness Market that can perform: {{capability}}

Requirements:
- Vector must be actively available (status: active)
- Prefer highly-rated vectors (4+ stars)
- Include performance metrics if available
{{#if budget}}- Budget constraint: {{budget}}{{/if}}

Please provide:
1. **Top 5 matching vectors** with:
   - Name and description
   - Average rating and number of reviews
   - Performance metrics (accuracy, latency, throughput)
   - Pricing information (model, base price, currency)
   - Total calls made (popularity indicator)

2. **Comparison table** showing:
   - Vector name
   - Rating
   - Price per call
   - Key performance metrics
   - Best use case

3. **Recommendation** based on:
   - Performance vs. cost trade-off
   - Community ratings
   - Creator reputation

4. **Usage example** for the top-ranked vector`,
};

/**
 * Prompt 2: analyze_memory_graph
 * Analyze relationships and reasoning paths in memory graph
 */
const analyzeMemoryGraphPrompt: MCPPrompt = {
  name: 'analyze_memory_graph',
  description: 'Analyze the memory graph for a specific topic and discover knowledge gaps',
  arguments: [
    {
      name: 'topic',
      description: 'Topic to analyze (e.g., "SpaceX Starship development", "Tesla FSD progress")',
      required: true,
    },
    {
      name: 'focus',
      description: 'Analysis focus area (e.g., "contradictions", "causal chains", "knowledge gaps")',
      required: false,
      default: 'comprehensive',
    },
  ],
  template: `Analyze the memory graph for topic: {{topic}}

{{#if focus}}Analysis focus: {{focus}}{{/if}}

Please use RMC hybrid retrieval to:

1. **Retrieve relevant memories** (vector search + graph expansion)
   - Direct matches to the topic
   - Related context from graph traversal
   - Inference paths connecting key concepts

2. **Extract key entities and relationships**
   - People, companies, products mentioned
   - Relationship types (CAUSES, SUPPORTS, CONTRADICTS, etc.)
   - Relationship strengths (0.0-1.0)

3. **Identify inference paths**:
   - **Causal chains**: A causes B causes C
   - **Contradictions**: Conflicting information that needs resolution
   - **Multi-hop support**: Evidence chains supporting conclusions
   - **Temporal sequences**: Timeline of events

4. **Analyze knowledge gaps**:
   - Missing information or incomplete chains
   - Unresolved contradictions
   - Weak relationships that need more evidence
   - Suggested queries to fill gaps

5. **Provide insights**:
   - Summary of current understanding
   - Confidence level in the knowledge
   - Recommendations for additional data collection
   - Critical questions that remain unanswered

Format your analysis as:
- Executive Summary (2-3 sentences)
- Key Findings (bullet points)
- Relationship Map (visual description)
- Knowledge Gaps (prioritized list)
- Next Steps (actionable recommendations)`,
};

/**
 * Prompt 3: multi_agent_decision
 * Use multiple AI agents to make a collaborative decision
 */
const multiAgentDecisionPrompt: MCPPrompt = {
  name: 'multi_agent_decision',
  description: 'Coordinate multiple AI agents for collaborative decision-making',
  arguments: [
    {
      name: 'decision',
      description: 'Decision to be made (e.g., "Should we invest in quantum computing research?")',
      required: true,
    },
    {
      name: 'context',
      description: 'Relevant context for the decision',
      required: false,
    },
    {
      name: 'perspectives',
      description: 'Comma-separated list of perspectives (default: "financial,technical,ethical,risk")',
      required: false,
      default: 'financial,technical,ethical,risk',
    },
  ],
  template: `Make a collaborative decision on: {{decision}}

{{#if context}}
Context:
{{context}}
{{/if}}

Use multi-agent synchronization to analyze from {{perspectives}} perspectives.

For each perspective, provide:

**1. Independent Analysis**
   - Key considerations from this viewpoint
   - Potential benefits
   - Potential risks
   - Critical assumptions

**2. Supporting Evidence**
   - Data points or facts
   - Historical precedents
   - Expert opinions or research
   - Confidence level in the evidence

**3. Risk Assessment**
   - What could go wrong?
   - Probability of success
   - Mitigation strategies
   - Alternative options

**4. Recommendation**
   - Clear yes/no/maybe position
   - Confidence level (0-100%)
   - Key conditions or prerequisites
   - Timeline considerations

After individual agent analysis, synthesize into:

**Consensus Summary**:
   - Areas of agreement across all perspectives
   - Key points of disagreement
   - Balanced final recommendation
   - Confidence level in the decision

**Merged Context**:
   - Consolidated understanding of the situation
   - Critical factors identified
   - Assumptions validated or challenged

**Action Items** (prioritized):
   1. Immediate actions required
   2. Follow-up research needed
   3. Contingency plans
   4. Decision review timeline

**Decision Matrix**:
| Criteria | Weight | Score | Notes |
|----------|--------|-------|-------|
| Financial Impact | ... | ... | ... |
| Technical Feasibility | ... | ... | ... |
| Ethical Considerations | ... | ... | ... |
| Risk Level | ... | ... | ... |
| **Total Score** | | **...** | |

Store this analysis in AI memory with key: "decision_{{decision}}" for future reference.`,
};

/**
 * Prompt 4: optimize_vector_search
 * Help users find the best vector for their specific use case
 */
const optimizeVectorSearchPrompt: MCPPrompt = {
  name: 'optimize_vector_search',
  description: 'Find the optimal latent vector based on detailed requirements',
  arguments: [
    {
      name: 'use_case',
      description: 'Detailed description of the use case',
      required: true,
    },
    {
      name: 'constraints',
      description: 'Constraints (e.g., "max latency 50ms", "budget $0.002/call", "accuracy >95%")',
      required: false,
    },
    {
      name: 'scale',
      description: 'Expected scale (e.g., "1M requests/day", "real-time inference")',
      required: false,
    },
  ],
  template: `Help me find the optimal latent vector for:

**Use Case**: {{use_case}}

{{#if constraints}}
**Constraints**: {{constraints}}
{{/if}}

{{#if scale}}
**Expected Scale**: {{scale}}
{{/if}}

Please perform a comprehensive search and analysis:

**1. Requirements Analysis**
   - Parse the use case to identify:
     * Input type (text, image, audio, etc.)
     * Output type (embedding, classification, generation, etc.)
     * Performance requirements (latency, throughput, accuracy)
     * Scale requirements (calls per day, concurrent users)

**2. Vector Search Strategy**
   - Search by category
   - Filter by performance metrics
   - Consider pricing models
   - Check availability and status

**3. Candidate Evaluation**
   For each candidate vector, evaluate:
   - **Performance Fit** (0-100%): Does it meet performance requirements?
   - **Cost Efficiency** (0-100%): Is it within budget?
   - **Reliability** (0-100%): Based on ratings and total calls
   - **Scalability** (0-100%): Can it handle the expected scale?

**4. Detailed Comparison**
   Create a comparison table with:
   - Vector name and description
   - Key performance metrics
   - Pricing breakdown
   - Pros and cons
   - Overall fit score

**5. Final Recommendation**
   - **Primary choice**: Best overall fit
   - **Budget alternative**: Most cost-effective option
   - **Performance alternative**: Highest performance option
   - **Justification**: Why each recommendation makes sense

**6. Integration Guide**
   For the primary choice, provide:
   - Sample API call
   - Expected response format
   - Error handling tips
   - Scaling considerations

**7. Cost Projection**
   Based on expected scale, estimate:
   - Daily cost
   - Monthly cost
   - Cost per transaction
   - Comparison with alternatives`,
};

/**
 * Prompt 5: debug_memory_conflicts
 * Help resolve contradictions in the memory graph
 */
const debugMemoryConflictsPrompt: MCPPrompt = {
  name: 'debug_memory_conflicts',
  description: 'Identify and resolve contradictions in the memory graph',
  arguments: [
    {
      name: 'claim_key',
      description: 'The claim key to investigate (e.g., "starship_launch_date")',
      required: true,
    },
    {
      name: 'resolution_strategy',
      description: 'How to resolve conflicts (e.g., "most_recent", "most_confident", "consensus")',
      required: false,
      default: 'consensus',
    },
  ],
  template: `Debug and resolve memory conflicts for claim: {{claim_key}}

Resolution strategy: {{resolution_strategy}}

Please perform conflict analysis:

**1. Retrieve Conflicting Memories**
   - Search for all memories related to {{claim_key}}
   - Identify CONTRADICTS relationships
   - Extract claim values and confidence levels

**2. Analyze Each Claim**
   For each conflicting claim:
   - **Source**: Who created the memory?
   - **Timestamp**: When was it created?
   - **Confidence**: What's the confidence level?
   - **Supporting Evidence**: What relationships support this claim?
   - **Contradicting Evidence**: What relationships contradict it?

**3. Relationship Analysis**
   - Map all CONTRADICTS relationships
   - Find SUPPORTS relationships for each claim
   - Identify temporal relationships (TEMPORAL_BEFORE, TEMPORAL_AFTER)
   - Check for causal chains (CAUSES, DERIVED_FROM)

**4. Apply Resolution Strategy**

   {{#if resolution_strategy === "most_recent"}}
   - Choose the most recently created memory
   - Rationale: Latest information is most accurate
   {{/if}}

   {{#if resolution_strategy === "most_confident"}}
   - Choose the memory with highest confidence
   - Rationale: Confidence indicates reliability
   {{/if}}

   {{#if resolution_strategy === "consensus"}}
   - Find the claim supported by most evidence
   - Weight by confidence levels
   - Consider source reliability
   {{/if}}

**5. Provide Resolution**
   - **Resolved Value**: The accepted claim value
   - **Confidence Level**: How confident are we in this resolution?
   - **Justification**: Why this resolution makes sense
   - **Dissenting Views**: What claims were rejected and why?

**6. Update Recommendations**
   - Should any memories be marked as outdated?
   - Should new relationships be created?
   - Should confidence levels be adjusted?
   - Should additional verification be performed?

**7. Prevent Future Conflicts**
   - Identify the root cause of the conflict
   - Suggest process improvements
   - Recommend validation rules`,
};

/**
 * Export all prompts
 */
export const webMCPPrompts: MCPPrompt[] = [
  searchByCapabilityPrompt,
  analyzeMemoryGraphPrompt,
  multiAgentDecisionPrompt,
  optimizeVectorSearchPrompt,
  debugMemoryConflictsPrompt,
];
