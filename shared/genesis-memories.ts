/**
 * Genesis Memory Capsules - Public Good Strategy
 * 
 * These are the first batch of "Golden Memory Capsules" that serve as:
 * 1. Bootstrap data for new agents joining the network
 * 2. Standard anchors for W-Matrix alignment verification
 * 3. Free samples to attract developers
 * 
 * When a Llama-3 model loads these capsules, its performance can
 * approach GPT-4 level in specific domains.
 */

import { AwarenessMemoryAsset, AWARENESS_CONTEXT } from './memory-nft-schema';

/**
 * Genesis Memory Categories
 */
export const GENESIS_CATEGORIES = [
  'general_reasoning',
  'code_generation',
  'blockchain_security',
  'legal_analysis',
  'scientific_research',
  'creative_writing',
  'data_analysis',
  'mathematics',
  'natural_language',
  'planning'
] as const;

export type GenesisCategory = typeof GENESIS_CATEGORIES[number];

/**
 * Create a genesis (public) memory asset
 */
function createGenesisMemory(
  id: string,
  name: string,
  description: string,
  domain: string,
  taskType: string,
  keywords: string[],
  modelOrigin: string = 'llama-3-70b',
  latentDimension: number = 4096
): AwarenessMemoryAsset {
  return {
    "@context": AWARENESS_CONTEXT["@context"],
    "@type": "awareness:MemoryAsset",
    identification: {
      name,
      description,
      version: "1.0.0",
      id
    },
    technical_spec: {
      "@type": "awareness:LatentSpec",
      model_origin: modelOrigin as any,
      latent_dimension: latentDimension,
      w_matrix_version: "v1.0-standard",
      alignment_loss_epsilon: 0.005,
      compression_type: "none"
    },
    semantic_context: {
      keywords,
      domain: domain as any,
      task_type: taskType as any,
      ai_description: description
    },
    access_control: {
      is_public: true, // Genesis memories are PUBLIC
      encrypted_cid: `ipfs://genesis-${id}`,
      price_per_call: "0 AMEM", // Free for public memories
      owner_agent_tba: "0x0000000000000000000000000000000000000000", // Protocol-owned
      subscription_tier: "free"
    },
    provenance: {
      parent_memory: null,
      created_at: new Date().toISOString(),
      usage_count: 0,
      average_rating: 5.0,
      rating_count: 0
    }
  };
}

/**
 * 100 Golden Memory Capsules - Bootstrap Data
 * 
 * These capsules cover essential reasoning patterns that any AI agent needs.
 * They are free to use and serve as calibration anchors for W-Matrix alignment.
 */
export const GENESIS_MEMORIES: AwarenessMemoryAsset[] = [
  // === GENERAL REASONING (10) ===
  createGenesisMemory(
    'genesis-001',
    'Chain-of-Thought Reasoning Patterns',
    'Fundamental step-by-step reasoning patterns for complex problem decomposition. Improves logical consistency by 40%.',
    'general_reasoning',
    'reasoning_and_analysis',
    ['reasoning', 'chain-of-thought', 'logic', 'problem-solving', 'decomposition']
  ),
  createGenesisMemory(
    'genesis-002',
    'Multi-Step Mathematical Reasoning',
    'Advanced mathematical reasoning chains for algebra, calculus, and discrete math problems.',
    'mathematics',
    'reasoning_and_analysis',
    ['math', 'algebra', 'calculus', 'proof', 'mathematical-reasoning']
  ),
  createGenesisMemory(
    'genesis-003',
    'Causal Inference Patterns',
    'Reasoning patterns for identifying cause-effect relationships in complex scenarios.',
    'general_reasoning',
    'reasoning_and_analysis',
    ['causality', 'inference', 'correlation', 'analysis', 'root-cause']
  ),
  createGenesisMemory(
    'genesis-004',
    'Analogical Reasoning Templates',
    'Patterns for drawing analogies between different domains to solve novel problems.',
    'general_reasoning',
    'reasoning_and_analysis',
    ['analogy', 'transfer-learning', 'abstraction', 'pattern-matching']
  ),
  createGenesisMemory(
    'genesis-005',
    'Counterfactual Reasoning',
    'Templates for "what if" analysis and alternative scenario evaluation.',
    'general_reasoning',
    'reasoning_and_analysis',
    ['counterfactual', 'hypothetical', 'scenario-analysis', 'alternative']
  ),
  createGenesisMemory(
    'genesis-006',
    'Deductive Logic Chains',
    'Formal deductive reasoning patterns from premises to conclusions.',
    'general_reasoning',
    'reasoning_and_analysis',
    ['deduction', 'logic', 'syllogism', 'formal-reasoning']
  ),
  createGenesisMemory(
    'genesis-007',
    'Inductive Pattern Recognition',
    'Patterns for generalizing from specific examples to broader principles.',
    'general_reasoning',
    'reasoning_and_analysis',
    ['induction', 'generalization', 'pattern', 'examples']
  ),
  createGenesisMemory(
    'genesis-008',
    'Abductive Hypothesis Generation',
    'Reasoning patterns for generating the most likely explanation from observations.',
    'general_reasoning',
    'reasoning_and_analysis',
    ['abduction', 'hypothesis', 'explanation', 'inference']
  ),
  createGenesisMemory(
    'genesis-009',
    'Meta-Cognitive Reflection',
    'Patterns for self-evaluation and reasoning quality assessment.',
    'general_reasoning',
    'reasoning_and_analysis',
    ['metacognition', 'self-reflection', 'evaluation', 'improvement']
  ),
  createGenesisMemory(
    'genesis-010',
    'Uncertainty Quantification',
    'Patterns for expressing and reasoning about uncertainty and confidence levels.',
    'general_reasoning',
    'reasoning_and_analysis',
    ['uncertainty', 'probability', 'confidence', 'bayesian']
  ),

  // === CODE GENERATION (15) ===
  createGenesisMemory(
    'genesis-011',
    'Python Best Practices',
    'Idiomatic Python patterns including list comprehensions, generators, and context managers.',
    'code_generation',
    'code_generation',
    ['python', 'best-practices', 'idioms', 'clean-code']
  ),
  createGenesisMemory(
    'genesis-012',
    'TypeScript Type Patterns',
    'Advanced TypeScript type manipulation including generics, conditional types, and mapped types.',
    'code_generation',
    'code_generation',
    ['typescript', 'types', 'generics', 'type-safety']
  ),
  createGenesisMemory(
    'genesis-013',
    'React Component Patterns',
    'Modern React patterns including hooks, composition, and performance optimization.',
    'code_generation',
    'code_generation',
    ['react', 'hooks', 'components', 'frontend', 'javascript']
  ),
  createGenesisMemory(
    'genesis-014',
    'API Design Patterns',
    'RESTful and GraphQL API design patterns for scalable backend services.',
    'code_generation',
    'code_generation',
    ['api', 'rest', 'graphql', 'backend', 'design']
  ),
  createGenesisMemory(
    'genesis-015',
    'Database Query Optimization',
    'SQL and NoSQL query optimization patterns for high-performance data access.',
    'code_generation',
    'code_generation',
    ['sql', 'database', 'optimization', 'query', 'performance']
  ),
  createGenesisMemory(
    'genesis-016',
    'Error Handling Patterns',
    'Robust error handling and recovery patterns across different programming paradigms.',
    'code_generation',
    'code_generation',
    ['error-handling', 'exceptions', 'recovery', 'resilience']
  ),
  createGenesisMemory(
    'genesis-017',
    'Async/Await Patterns',
    'Asynchronous programming patterns for concurrent and parallel execution.',
    'code_generation',
    'code_generation',
    ['async', 'await', 'concurrency', 'parallel', 'promises']
  ),
  createGenesisMemory(
    'genesis-018',
    'Testing Patterns',
    'Unit testing, integration testing, and TDD patterns for reliable software.',
    'code_generation',
    'code_generation',
    ['testing', 'unit-test', 'tdd', 'jest', 'pytest']
  ),
  createGenesisMemory(
    'genesis-019',
    'Design Patterns - Creational',
    'Factory, Builder, Singleton, and other creational design patterns.',
    'code_generation',
    'code_generation',
    ['design-patterns', 'factory', 'builder', 'singleton', 'oop']
  ),
  createGenesisMemory(
    'genesis-020',
    'Design Patterns - Structural',
    'Adapter, Decorator, Facade, and other structural design patterns.',
    'code_generation',
    'code_generation',
    ['design-patterns', 'adapter', 'decorator', 'facade', 'oop']
  ),
  createGenesisMemory(
    'genesis-021',
    'Design Patterns - Behavioral',
    'Observer, Strategy, Command, and other behavioral design patterns.',
    'code_generation',
    'code_generation',
    ['design-patterns', 'observer', 'strategy', 'command', 'oop']
  ),
  createGenesisMemory(
    'genesis-022',
    'Rust Memory Safety Patterns',
    'Ownership, borrowing, and lifetime patterns for safe Rust code.',
    'code_generation',
    'code_generation',
    ['rust', 'memory-safety', 'ownership', 'borrowing', 'lifetimes']
  ),
  createGenesisMemory(
    'genesis-023',
    'Go Concurrency Patterns',
    'Goroutines, channels, and concurrent programming patterns in Go.',
    'code_generation',
    'code_generation',
    ['go', 'golang', 'concurrency', 'goroutines', 'channels']
  ),
  createGenesisMemory(
    'genesis-024',
    'Microservices Architecture',
    'Patterns for building and orchestrating microservices systems.',
    'code_generation',
    'code_generation',
    ['microservices', 'architecture', 'docker', 'kubernetes', 'distributed']
  ),
  createGenesisMemory(
    'genesis-025',
    'CI/CD Pipeline Patterns',
    'Continuous integration and deployment patterns for DevOps workflows.',
    'code_generation',
    'code_generation',
    ['cicd', 'devops', 'automation', 'deployment', 'github-actions']
  ),

  // === BLOCKCHAIN SECURITY (15) ===
  createGenesisMemory(
    'genesis-026',
    'Reentrancy Attack Detection',
    'Expert patterns for identifying reentrancy vulnerabilities in Solidity contracts.',
    'blockchain_security',
    'reasoning_and_analysis',
    ['solidity', 'reentrancy', 'security', 'audit', 'vulnerability']
  ),
  createGenesisMemory(
    'genesis-027',
    'Flash Loan Attack Patterns',
    'Detection patterns for flash loan exploits in DeFi protocols.',
    'blockchain_security',
    'reasoning_and_analysis',
    ['flash-loan', 'defi', 'exploit', 'security', 'attack']
  ),
  createGenesisMemory(
    'genesis-028',
    'Oracle Manipulation Detection',
    'Patterns for identifying price oracle manipulation vulnerabilities.',
    'blockchain_security',
    'reasoning_and_analysis',
    ['oracle', 'price-manipulation', 'defi', 'security', 'chainlink']
  ),
  createGenesisMemory(
    'genesis-029',
    'Access Control Vulnerabilities',
    'Patterns for detecting improper access control in smart contracts.',
    'blockchain_security',
    'reasoning_and_analysis',
    ['access-control', 'authorization', 'permissions', 'security']
  ),
  createGenesisMemory(
    'genesis-030',
    'Integer Overflow/Underflow',
    'Detection patterns for arithmetic vulnerabilities in Solidity.',
    'blockchain_security',
    'reasoning_and_analysis',
    ['overflow', 'underflow', 'arithmetic', 'solidity', 'safeMath']
  ),
  createGenesisMemory(
    'genesis-031',
    'Front-Running Prevention',
    'Patterns for identifying and preventing front-running attacks.',
    'blockchain_security',
    'reasoning_and_analysis',
    ['front-running', 'mev', 'sandwich', 'transaction-ordering']
  ),
  createGenesisMemory(
    'genesis-032',
    'Proxy Contract Security',
    'Security patterns for upgradeable proxy contracts.',
    'blockchain_security',
    'reasoning_and_analysis',
    ['proxy', 'upgradeable', 'delegatecall', 'storage-collision']
  ),
  createGenesisMemory(
    'genesis-033',
    'Gas Optimization Patterns',
    'Patterns for optimizing gas consumption in smart contracts.',
    'blockchain_security',
    'reasoning_and_analysis',
    ['gas', 'optimization', 'efficiency', 'solidity', 'evm']
  ),
  createGenesisMemory(
    'genesis-034',
    'Cross-Chain Bridge Security',
    'Security patterns for cross-chain bridge implementations.',
    'blockchain_security',
    'reasoning_and_analysis',
    ['bridge', 'cross-chain', 'interoperability', 'security']
  ),
  createGenesisMemory(
    'genesis-035',
    'NFT Security Patterns',
    'Security considerations for NFT contracts and marketplaces.',
    'blockchain_security',
    'reasoning_and_analysis',
    ['nft', 'erc721', 'erc1155', 'marketplace', 'security']
  ),
  createGenesisMemory(
    'genesis-036',
    'DeFi Protocol Analysis',
    'Comprehensive analysis patterns for DeFi protocol security.',
    'blockchain_security',
    'reasoning_and_analysis',
    ['defi', 'protocol', 'analysis', 'security', 'audit']
  ),
  createGenesisMemory(
    'genesis-037',
    'Signature Verification Patterns',
    'Patterns for secure signature verification in smart contracts.',
    'blockchain_security',
    'reasoning_and_analysis',
    ['signature', 'ecdsa', 'verification', 'replay-attack']
  ),
  createGenesisMemory(
    'genesis-038',
    'Timestamp Dependence',
    'Detection patterns for timestamp manipulation vulnerabilities.',
    'blockchain_security',
    'reasoning_and_analysis',
    ['timestamp', 'block', 'manipulation', 'randomness']
  ),
  createGenesisMemory(
    'genesis-039',
    'Denial of Service Patterns',
    'Patterns for identifying DoS vulnerabilities in contracts.',
    'blockchain_security',
    'reasoning_and_analysis',
    ['dos', 'denial-of-service', 'gas-limit', 'loop']
  ),
  createGenesisMemory(
    'genesis-040',
    'ERC-6551 Token Bound Accounts',
    'Implementation patterns for ERC-6551 token bound accounts.',
    'blockchain_security',
    'code_generation',
    ['erc6551', 'tba', 'token-bound', 'nft', 'account-abstraction']
  ),

  // === DATA ANALYSIS (10) ===
  createGenesisMemory(
    'genesis-041',
    'Statistical Analysis Patterns',
    'Patterns for descriptive and inferential statistical analysis.',
    'data_analysis',
    'data_extraction',
    ['statistics', 'analysis', 'hypothesis-testing', 'correlation']
  ),
  createGenesisMemory(
    'genesis-042',
    'Data Cleaning Patterns',
    'Patterns for handling missing values, outliers, and data quality issues.',
    'data_analysis',
    'data_extraction',
    ['data-cleaning', 'preprocessing', 'outliers', 'missing-values']
  ),
  createGenesisMemory(
    'genesis-043',
    'Time Series Analysis',
    'Patterns for analyzing and forecasting time series data.',
    'data_analysis',
    'reasoning_and_analysis',
    ['time-series', 'forecasting', 'trend', 'seasonality']
  ),
  createGenesisMemory(
    'genesis-044',
    'Data Visualization Patterns',
    'Best practices for creating effective data visualizations.',
    'data_analysis',
    'data_extraction',
    ['visualization', 'charts', 'graphs', 'dashboard']
  ),
  createGenesisMemory(
    'genesis-045',
    'A/B Testing Analysis',
    'Patterns for designing and analyzing A/B experiments.',
    'data_analysis',
    'reasoning_and_analysis',
    ['ab-testing', 'experiment', 'significance', 'conversion']
  ),
  createGenesisMemory(
    'genesis-046',
    'Cohort Analysis Patterns',
    'Patterns for user cohort analysis and retention metrics.',
    'data_analysis',
    'reasoning_and_analysis',
    ['cohort', 'retention', 'churn', 'user-analysis']
  ),
  createGenesisMemory(
    'genesis-047',
    'Funnel Analysis',
    'Patterns for conversion funnel analysis and optimization.',
    'data_analysis',
    'reasoning_and_analysis',
    ['funnel', 'conversion', 'drop-off', 'optimization']
  ),
  createGenesisMemory(
    'genesis-048',
    'Anomaly Detection',
    'Patterns for detecting anomalies in datasets.',
    'data_analysis',
    'reasoning_and_analysis',
    ['anomaly', 'outlier', 'detection', 'monitoring']
  ),
  createGenesisMemory(
    'genesis-049',
    'Feature Engineering',
    'Patterns for creating effective features for ML models.',
    'data_analysis',
    'data_extraction',
    ['feature-engineering', 'ml', 'preprocessing', 'transformation']
  ),
  createGenesisMemory(
    'genesis-050',
    'SQL Analytics Patterns',
    'Advanced SQL patterns for data analysis and reporting.',
    'data_analysis',
    'data_extraction',
    ['sql', 'analytics', 'window-functions', 'cte', 'aggregation']
  ),

  // === NATURAL LANGUAGE (10) ===
  createGenesisMemory(
    'genesis-051',
    'Text Summarization Patterns',
    'Patterns for extractive and abstractive text summarization.',
    'natural_language_processing',
    'summarization',
    ['summarization', 'extraction', 'abstraction', 'nlp']
  ),
  createGenesisMemory(
    'genesis-052',
    'Named Entity Recognition',
    'Patterns for identifying and classifying named entities.',
    'natural_language_processing',
    'data_extraction',
    ['ner', 'entity', 'extraction', 'classification']
  ),
  createGenesisMemory(
    'genesis-053',
    'Sentiment Analysis',
    'Patterns for analyzing sentiment and emotion in text.',
    'natural_language_processing',
    'classification',
    ['sentiment', 'emotion', 'opinion', 'analysis']
  ),
  createGenesisMemory(
    'genesis-054',
    'Question Answering Patterns',
    'Patterns for extractive and generative question answering.',
    'natural_language_processing',
    'question_answering',
    ['qa', 'question-answering', 'comprehension', 'extraction']
  ),
  createGenesisMemory(
    'genesis-055',
    'Text Classification',
    'Patterns for multi-class and multi-label text classification.',
    'natural_language_processing',
    'classification',
    ['classification', 'categorization', 'labeling', 'nlp']
  ),
  createGenesisMemory(
    'genesis-056',
    'Translation Patterns',
    'Patterns for high-quality machine translation.',
    'natural_language_processing',
    'translation',
    ['translation', 'multilingual', 'localization', 'language']
  ),
  createGenesisMemory(
    'genesis-057',
    'Information Extraction',
    'Patterns for extracting structured information from text.',
    'natural_language_processing',
    'data_extraction',
    ['extraction', 'structured', 'parsing', 'nlp']
  ),
  createGenesisMemory(
    'genesis-058',
    'Dialogue Generation',
    'Patterns for generating coherent multi-turn dialogues.',
    'natural_language_processing',
    'creative_generation',
    ['dialogue', 'conversation', 'chatbot', 'generation']
  ),
  createGenesisMemory(
    'genesis-059',
    'Paraphrase Generation',
    'Patterns for generating diverse paraphrases of text.',
    'natural_language_processing',
    'creative_generation',
    ['paraphrase', 'rewriting', 'variation', 'nlp']
  ),
  createGenesisMemory(
    'genesis-060',
    'Coreference Resolution',
    'Patterns for resolving pronouns and references in text.',
    'natural_language_processing',
    'reasoning_and_analysis',
    ['coreference', 'pronoun', 'resolution', 'anaphora']
  ),

  // === PLANNING & EXECUTION (10) ===
  createGenesisMemory(
    'genesis-061',
    'Task Decomposition',
    'Patterns for breaking complex tasks into manageable subtasks.',
    'general_reasoning',
    'planning_and_execution',
    ['planning', 'decomposition', 'subtasks', 'hierarchy']
  ),
  createGenesisMemory(
    'genesis-062',
    'Goal-Oriented Planning',
    'Patterns for planning actions to achieve specific goals.',
    'general_reasoning',
    'planning_and_execution',
    ['goal', 'planning', 'action', 'achievement']
  ),
  createGenesisMemory(
    'genesis-063',
    'Resource Allocation',
    'Patterns for optimal resource allocation in planning.',
    'general_reasoning',
    'planning_and_execution',
    ['resource', 'allocation', 'optimization', 'scheduling']
  ),
  createGenesisMemory(
    'genesis-064',
    'Constraint Satisfaction',
    'Patterns for solving constraint satisfaction problems.',
    'general_reasoning',
    'planning_and_execution',
    ['constraints', 'satisfaction', 'csp', 'optimization']
  ),
  createGenesisMemory(
    'genesis-065',
    'Sequential Decision Making',
    'Patterns for making optimal sequential decisions.',
    'general_reasoning',
    'planning_and_execution',
    ['sequential', 'decision', 'mdp', 'policy']
  ),
  createGenesisMemory(
    'genesis-066',
    'Multi-Agent Coordination',
    'Patterns for coordinating actions between multiple agents.',
    'general_reasoning',
    'planning_and_execution',
    ['multi-agent', 'coordination', 'collaboration', 'distributed']
  ),
  createGenesisMemory(
    'genesis-067',
    'Replanning and Adaptation',
    'Patterns for adapting plans when conditions change.',
    'general_reasoning',
    'planning_and_execution',
    ['replanning', 'adaptation', 'dynamic', 'recovery']
  ),
  createGenesisMemory(
    'genesis-068',
    'Risk Assessment in Planning',
    'Patterns for assessing and mitigating risks in plans.',
    'general_reasoning',
    'planning_and_execution',
    ['risk', 'assessment', 'mitigation', 'contingency']
  ),
  createGenesisMemory(
    'genesis-069',
    'Temporal Planning',
    'Patterns for planning with temporal constraints.',
    'general_reasoning',
    'planning_and_execution',
    ['temporal', 'scheduling', 'deadline', 'duration']
  ),
  createGenesisMemory(
    'genesis-070',
    'Hierarchical Task Networks',
    'Patterns for hierarchical task network planning.',
    'general_reasoning',
    'planning_and_execution',
    ['htn', 'hierarchical', 'task-network', 'decomposition']
  ),

  // === CREATIVE WRITING (10) ===
  createGenesisMemory(
    'genesis-071',
    'Story Structure Patterns',
    'Patterns for creating compelling narrative structures.',
    'creative_writing',
    'creative_generation',
    ['story', 'narrative', 'structure', 'plot']
  ),
  createGenesisMemory(
    'genesis-072',
    'Character Development',
    'Patterns for creating deep, consistent characters.',
    'creative_writing',
    'creative_generation',
    ['character', 'development', 'personality', 'arc']
  ),
  createGenesisMemory(
    'genesis-073',
    'Dialogue Writing',
    'Patterns for writing natural, engaging dialogue.',
    'creative_writing',
    'creative_generation',
    ['dialogue', 'conversation', 'voice', 'subtext']
  ),
  createGenesisMemory(
    'genesis-074',
    'World Building',
    'Patterns for creating consistent fictional worlds.',
    'creative_writing',
    'creative_generation',
    ['worldbuilding', 'setting', 'lore', 'consistency']
  ),
  createGenesisMemory(
    'genesis-075',
    'Technical Writing',
    'Patterns for clear, precise technical documentation.',
    'creative_writing',
    'creative_generation',
    ['technical', 'documentation', 'clarity', 'precision']
  ),
  createGenesisMemory(
    'genesis-076',
    'Persuasive Writing',
    'Patterns for compelling persuasive arguments.',
    'creative_writing',
    'creative_generation',
    ['persuasion', 'argument', 'rhetoric', 'influence']
  ),
  createGenesisMemory(
    'genesis-077',
    'Poetry Generation',
    'Patterns for generating poetry with meter and rhyme.',
    'creative_writing',
    'creative_generation',
    ['poetry', 'verse', 'rhyme', 'meter']
  ),
  createGenesisMemory(
    'genesis-078',
    'Humor and Wit',
    'Patterns for generating humor and witty responses.',
    'creative_writing',
    'creative_generation',
    ['humor', 'wit', 'comedy', 'jokes']
  ),
  createGenesisMemory(
    'genesis-079',
    'Emotional Tone Control',
    'Patterns for controlling emotional tone in writing.',
    'creative_writing',
    'creative_generation',
    ['tone', 'emotion', 'mood', 'style']
  ),
  createGenesisMemory(
    'genesis-080',
    'Copywriting Patterns',
    'Patterns for effective marketing and advertising copy.',
    'creative_writing',
    'creative_generation',
    ['copywriting', 'marketing', 'advertising', 'conversion']
  ),

  // === SCIENTIFIC RESEARCH (10) ===
  createGenesisMemory(
    'genesis-081',
    'Literature Review Synthesis',
    'Patterns for synthesizing research literature.',
    'scientific_research',
    'summarization',
    ['literature', 'review', 'synthesis', 'research']
  ),
  createGenesisMemory(
    'genesis-082',
    'Hypothesis Formulation',
    'Patterns for formulating testable scientific hypotheses.',
    'scientific_research',
    'reasoning_and_analysis',
    ['hypothesis', 'research', 'scientific-method', 'testable']
  ),
  createGenesisMemory(
    'genesis-083',
    'Experimental Design',
    'Patterns for designing rigorous experiments.',
    'scientific_research',
    'planning_and_execution',
    ['experiment', 'design', 'control', 'variables']
  ),
  createGenesisMemory(
    'genesis-084',
    'Statistical Significance',
    'Patterns for determining statistical significance.',
    'scientific_research',
    'reasoning_and_analysis',
    ['statistics', 'significance', 'p-value', 'confidence']
  ),
  createGenesisMemory(
    'genesis-085',
    'Research Paper Structure',
    'Patterns for structuring academic research papers.',
    'scientific_research',
    'creative_generation',
    ['paper', 'academic', 'structure', 'publication']
  ),
  createGenesisMemory(
    'genesis-086',
    'Citation Analysis',
    'Patterns for analyzing and synthesizing citations.',
    'scientific_research',
    'data_extraction',
    ['citation', 'reference', 'bibliography', 'analysis']
  ),
  createGenesisMemory(
    'genesis-087',
    'Peer Review Patterns',
    'Patterns for conducting thorough peer reviews.',
    'scientific_research',
    'reasoning_and_analysis',
    ['peer-review', 'critique', 'feedback', 'evaluation']
  ),
  createGenesisMemory(
    'genesis-088',
    'Research Methodology',
    'Patterns for selecting appropriate research methodologies.',
    'scientific_research',
    'planning_and_execution',
    ['methodology', 'qualitative', 'quantitative', 'mixed-methods']
  ),
  createGenesisMemory(
    'genesis-089',
    'Data Interpretation',
    'Patterns for interpreting research data accurately.',
    'scientific_research',
    'reasoning_and_analysis',
    ['interpretation', 'data', 'analysis', 'conclusions']
  ),
  createGenesisMemory(
    'genesis-090',
    'Reproducibility Patterns',
    'Patterns for ensuring research reproducibility.',
    'scientific_research',
    'code_generation',
    ['reproducibility', 'replication', 'methodology', 'transparency']
  ),

  // === LEGAL ANALYSIS (10) ===
  createGenesisMemory(
    'genesis-091',
    'Contract Analysis',
    'Patterns for analyzing legal contracts and agreements.',
    'legal_analysis',
    'reasoning_and_analysis',
    ['contract', 'legal', 'analysis', 'terms', 'agreement']
  ),
  createGenesisMemory(
    'genesis-092',
    'Legal Precedent Research',
    'Patterns for researching and applying legal precedents.',
    'legal_analysis',
    'reasoning_and_analysis',
    ['precedent', 'case-law', 'research', 'citation']
  ),
  createGenesisMemory(
    'genesis-093',
    'Regulatory Compliance',
    'Patterns for analyzing regulatory compliance requirements.',
    'legal_analysis',
    'reasoning_and_analysis',
    ['compliance', 'regulation', 'requirements', 'audit']
  ),
  createGenesisMemory(
    'genesis-094',
    'Privacy Law Analysis',
    'Patterns for analyzing privacy laws (GDPR, CCPA, etc.).',
    'legal_analysis',
    'reasoning_and_analysis',
    ['privacy', 'gdpr', 'ccpa', 'data-protection']
  ),
  createGenesisMemory(
    'genesis-095',
    'Intellectual Property',
    'Patterns for analyzing IP rights and protections.',
    'legal_analysis',
    'reasoning_and_analysis',
    ['ip', 'patent', 'copyright', 'trademark']
  ),
  createGenesisMemory(
    'genesis-096',
    'Legal Document Drafting',
    'Patterns for drafting legal documents.',
    'legal_analysis',
    'creative_generation',
    ['drafting', 'legal-document', 'template', 'clause']
  ),
  createGenesisMemory(
    'genesis-097',
    'Risk Assessment Legal',
    'Patterns for legal risk assessment.',
    'legal_analysis',
    'reasoning_and_analysis',
    ['risk', 'legal', 'assessment', 'liability']
  ),
  createGenesisMemory(
    'genesis-098',
    'Dispute Resolution',
    'Patterns for analyzing dispute resolution options.',
    'legal_analysis',
    'reasoning_and_analysis',
    ['dispute', 'resolution', 'arbitration', 'mediation']
  ),
  createGenesisMemory(
    'genesis-099',
    'Securities Law',
    'Patterns for analyzing securities regulations.',
    'legal_analysis',
    'reasoning_and_analysis',
    ['securities', 'sec', 'regulation', 'compliance']
  ),
  createGenesisMemory(
    'genesis-100',
    'Smart Contract Legal',
    'Patterns for legal analysis of smart contracts.',
    'legal_analysis',
    'reasoning_and_analysis',
    ['smart-contract', 'legal', 'enforceability', 'jurisdiction']
  )
];

/**
 * Get genesis memories by category
 */
export function getGenesisByCategory(category: GenesisCategory): AwarenessMemoryAsset[] {
  const categoryMap: Record<GenesisCategory, string[]> = {
    'general_reasoning': ['general_reasoning'],
    'code_generation': ['code_generation'],
    'blockchain_security': ['blockchain_security'],
    'legal_analysis': ['legal_analysis'],
    'scientific_research': ['scientific_research'],
    'creative_writing': ['creative_writing'],
    'data_analysis': ['data_analysis'],
    'mathematics': ['mathematics'],
    'natural_language': ['natural_language_processing'],
    'planning': ['planning_and_execution']
  };
  
  const domains = categoryMap[category];
  return GENESIS_MEMORIES.filter(m => 
    domains.includes(m.semantic_context.domain) || 
    domains.includes(m.semantic_context.task_type)
  );
}

/**
 * Search genesis memories by keyword
 */
export function searchGenesisMemories(keyword: string): AwarenessMemoryAsset[] {
  const lowerKeyword = keyword.toLowerCase();
  return GENESIS_MEMORIES.filter(m =>
    m.identification.name.toLowerCase().includes(lowerKeyword) ||
    m.identification.description.toLowerCase().includes(lowerKeyword) ||
    m.semantic_context.keywords.some(k => k.toLowerCase().includes(lowerKeyword))
  );
}

/**
 * Get total count of genesis memories
 */
export const GENESIS_MEMORY_COUNT = GENESIS_MEMORIES.length;
