/**
 * Genesis Memories Database Seeding Script
 * 
 * This script seeds the database with 100 golden memory capsules
 * from the GENESIS_MEMORIES collection.
 * 
 * Usage: node scripts/seed-genesis-memories.mjs
 */

import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';

// Load environment variables
config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Parse database URL
function parseDatabaseUrl(url) {
  const regex = /mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
  const match = url.match(regex);
  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4]),
    database: match[5].split('?')[0]
  };
}

// Genesis memory categories
const GENESIS_CATEGORIES = [
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
];

// Create genesis memory data
function createGenesisMemory(id, name, description, domain, taskType, keywords, modelOrigin = 'llama-3-70b', latentDimension = 4096) {
  return {
    id,
    name,
    description,
    domain,
    taskType,
    keywords,
    modelOrigin,
    latentDimension
  };
}

// 100 Golden Memory Capsules
const GENESIS_MEMORIES = [
  // === GENERAL REASONING (10) ===
  createGenesisMemory('genesis-001', 'Chain-of-Thought Reasoning Patterns', 'Fundamental step-by-step reasoning patterns for complex problem decomposition. Improves logical consistency by 40%.', 'general_reasoning', 'reasoning_and_analysis', ['reasoning', 'chain-of-thought', 'logic', 'problem-solving', 'decomposition']),
  createGenesisMemory('genesis-002', 'Multi-Step Mathematical Reasoning', 'Advanced mathematical reasoning chains for algebra, calculus, and discrete math problems.', 'mathematics', 'reasoning_and_analysis', ['math', 'algebra', 'calculus', 'proof', 'mathematical-reasoning']),
  createGenesisMemory('genesis-003', 'Causal Inference Patterns', 'Reasoning patterns for identifying cause-effect relationships in complex scenarios.', 'general_reasoning', 'reasoning_and_analysis', ['causality', 'inference', 'correlation', 'analysis', 'root-cause']),
  createGenesisMemory('genesis-004', 'Analogical Reasoning Templates', 'Patterns for drawing analogies between different domains to solve novel problems.', 'general_reasoning', 'reasoning_and_analysis', ['analogy', 'transfer-learning', 'abstraction', 'pattern-matching']),
  createGenesisMemory('genesis-005', 'Counterfactual Reasoning', 'Templates for "what if" analysis and alternative scenario evaluation.', 'general_reasoning', 'reasoning_and_analysis', ['counterfactual', 'hypothetical', 'scenario-analysis', 'alternative']),
  createGenesisMemory('genesis-006', 'Deductive Logic Chains', 'Formal deductive reasoning patterns from premises to conclusions.', 'general_reasoning', 'reasoning_and_analysis', ['deduction', 'logic', 'syllogism', 'formal-reasoning']),
  createGenesisMemory('genesis-007', 'Inductive Pattern Recognition', 'Patterns for generalizing from specific examples to broader principles.', 'general_reasoning', 'reasoning_and_analysis', ['induction', 'generalization', 'pattern', 'examples']),
  createGenesisMemory('genesis-008', 'Abductive Hypothesis Generation', 'Reasoning patterns for generating the most likely explanation from observations.', 'general_reasoning', 'reasoning_and_analysis', ['abduction', 'hypothesis', 'explanation', 'inference']),
  createGenesisMemory('genesis-009', 'Meta-Cognitive Reflection', 'Patterns for self-evaluation and reasoning quality assessment.', 'general_reasoning', 'reasoning_and_analysis', ['metacognition', 'self-reflection', 'evaluation', 'improvement']),
  createGenesisMemory('genesis-010', 'Uncertainty Quantification', 'Patterns for expressing and reasoning about uncertainty and confidence levels.', 'general_reasoning', 'reasoning_and_analysis', ['uncertainty', 'probability', 'confidence', 'bayesian']),

  // === CODE GENERATION (15) ===
  createGenesisMemory('genesis-011', 'Python Best Practices', 'Idiomatic Python patterns including list comprehensions, generators, and context managers.', 'code_generation', 'code_generation', ['python', 'best-practices', 'idioms', 'clean-code']),
  createGenesisMemory('genesis-012', 'TypeScript Type Patterns', 'Advanced TypeScript type manipulation including generics, conditional types, and mapped types.', 'code_generation', 'code_generation', ['typescript', 'types', 'generics', 'type-safety']),
  createGenesisMemory('genesis-013', 'React Component Patterns', 'Modern React patterns including hooks, composition, and performance optimization.', 'code_generation', 'code_generation', ['react', 'hooks', 'components', 'frontend', 'javascript']),
  createGenesisMemory('genesis-014', 'API Design Patterns', 'RESTful and GraphQL API design patterns for scalable backend services.', 'code_generation', 'code_generation', ['api', 'rest', 'graphql', 'backend', 'design']),
  createGenesisMemory('genesis-015', 'Database Query Optimization', 'SQL and NoSQL query optimization patterns for high-performance data access.', 'code_generation', 'code_generation', ['sql', 'database', 'optimization', 'query', 'performance']),
  createGenesisMemory('genesis-016', 'Error Handling Patterns', 'Robust error handling and recovery patterns across different programming paradigms.', 'code_generation', 'code_generation', ['error-handling', 'exceptions', 'recovery', 'resilience']),
  createGenesisMemory('genesis-017', 'Async/Await Patterns', 'Asynchronous programming patterns for concurrent and parallel execution.', 'code_generation', 'code_generation', ['async', 'await', 'concurrency', 'parallel', 'promises']),
  createGenesisMemory('genesis-018', 'Testing Patterns', 'Unit testing, integration testing, and TDD patterns for reliable software.', 'code_generation', 'code_generation', ['testing', 'unit-test', 'tdd', 'jest', 'pytest']),
  createGenesisMemory('genesis-019', 'Design Patterns - Creational', 'Factory, Builder, Singleton, and other creational design patterns.', 'code_generation', 'code_generation', ['design-patterns', 'factory', 'builder', 'singleton', 'oop']),
  createGenesisMemory('genesis-020', 'Design Patterns - Structural', 'Adapter, Decorator, Facade, and other structural design patterns.', 'code_generation', 'code_generation', ['design-patterns', 'adapter', 'decorator', 'facade', 'oop']),
  createGenesisMemory('genesis-021', 'Design Patterns - Behavioral', 'Observer, Strategy, Command, and other behavioral design patterns.', 'code_generation', 'code_generation', ['design-patterns', 'observer', 'strategy', 'command', 'oop']),
  createGenesisMemory('genesis-022', 'Rust Memory Safety Patterns', 'Ownership, borrowing, and lifetime patterns for safe Rust code.', 'code_generation', 'code_generation', ['rust', 'memory-safety', 'ownership', 'borrowing', 'lifetimes']),
  createGenesisMemory('genesis-023', 'Go Concurrency Patterns', 'Goroutines, channels, and concurrent programming patterns in Go.', 'code_generation', 'code_generation', ['go', 'golang', 'concurrency', 'goroutines', 'channels']),
  createGenesisMemory('genesis-024', 'Microservices Architecture', 'Patterns for building and orchestrating microservices systems.', 'code_generation', 'code_generation', ['microservices', 'architecture', 'docker', 'kubernetes', 'distributed']),
  createGenesisMemory('genesis-025', 'CI/CD Pipeline Patterns', 'Continuous integration and deployment patterns for DevOps workflows.', 'code_generation', 'code_generation', ['cicd', 'devops', 'automation', 'deployment', 'github-actions']),

  // === BLOCKCHAIN SECURITY (15) ===
  createGenesisMemory('genesis-026', 'Reentrancy Attack Detection', 'Expert patterns for identifying reentrancy vulnerabilities in Solidity contracts.', 'blockchain_security', 'reasoning_and_analysis', ['solidity', 'reentrancy', 'security', 'audit', 'vulnerability']),
  createGenesisMemory('genesis-027', 'Flash Loan Attack Patterns', 'Detection patterns for flash loan exploits in DeFi protocols.', 'blockchain_security', 'reasoning_and_analysis', ['defi', 'flash-loan', 'exploit', 'security', 'arbitrage']),
  createGenesisMemory('genesis-028', 'Oracle Manipulation Detection', 'Patterns for identifying price oracle manipulation vulnerabilities.', 'blockchain_security', 'reasoning_and_analysis', ['oracle', 'price-manipulation', 'chainlink', 'defi', 'security']),
  createGenesisMemory('genesis-029', 'Access Control Audit', 'Smart contract access control and permission vulnerability patterns.', 'blockchain_security', 'reasoning_and_analysis', ['access-control', 'permissions', 'admin', 'ownership', 'security']),
  createGenesisMemory('genesis-030', 'Integer Overflow Detection', 'Patterns for detecting integer overflow/underflow vulnerabilities.', 'blockchain_security', 'reasoning_and_analysis', ['overflow', 'underflow', 'safemath', 'solidity', 'security']),
  createGenesisMemory('genesis-031', 'Front-Running Prevention', 'Patterns for identifying and preventing front-running attacks.', 'blockchain_security', 'reasoning_and_analysis', ['front-running', 'mev', 'sandwich', 'mempool', 'security']),
  createGenesisMemory('genesis-032', 'Gas Optimization Patterns', 'Smart contract gas optimization techniques and patterns.', 'blockchain_security', 'code_generation', ['gas', 'optimization', 'solidity', 'efficiency', 'cost']),
  createGenesisMemory('genesis-033', 'Proxy Contract Security', 'Security patterns for upgradeable proxy contracts.', 'blockchain_security', 'reasoning_and_analysis', ['proxy', 'upgradeable', 'diamond', 'storage', 'security']),
  createGenesisMemory('genesis-034', 'Cross-Chain Bridge Security', 'Security analysis patterns for cross-chain bridge protocols.', 'blockchain_security', 'reasoning_and_analysis', ['bridge', 'cross-chain', 'interoperability', 'security', 'relay']),
  createGenesisMemory('genesis-035', 'NFT Security Patterns', 'Security patterns specific to NFT contracts and marketplaces.', 'blockchain_security', 'reasoning_and_analysis', ['nft', 'erc721', 'marketplace', 'royalty', 'security']),
  createGenesisMemory('genesis-036', 'DeFi Protocol Analysis', 'Comprehensive DeFi protocol security analysis patterns.', 'blockchain_security', 'reasoning_and_analysis', ['defi', 'protocol', 'tvl', 'liquidity', 'security']),
  createGenesisMemory('genesis-037', 'Governance Attack Vectors', 'Patterns for identifying DAO governance attack vectors.', 'blockchain_security', 'reasoning_and_analysis', ['governance', 'dao', 'voting', 'proposal', 'security']),
  createGenesisMemory('genesis-038', 'Token Economics Analysis', 'Patterns for analyzing tokenomics and economic attack vectors.', 'blockchain_security', 'reasoning_and_analysis', ['tokenomics', 'economics', 'inflation', 'supply', 'security']),
  createGenesisMemory('genesis-039', 'MEV Protection Strategies', 'Patterns for protecting against MEV extraction.', 'blockchain_security', 'reasoning_and_analysis', ['mev', 'flashbots', 'protection', 'privacy', 'security']),
  createGenesisMemory('genesis-040', 'Formal Verification Patterns', 'Patterns for formal verification of smart contracts.', 'blockchain_security', 'reasoning_and_analysis', ['formal-verification', 'certora', 'invariants', 'proof', 'security']),

  // === DATA ANALYSIS (10) ===
  createGenesisMemory('genesis-041', 'Exploratory Data Analysis', 'Systematic EDA patterns for understanding datasets.', 'data_analysis', 'data_analysis', ['eda', 'statistics', 'visualization', 'pandas', 'analysis']),
  createGenesisMemory('genesis-042', 'Time Series Analysis', 'Patterns for analyzing and forecasting time series data.', 'data_analysis', 'data_analysis', ['time-series', 'forecasting', 'arima', 'seasonality', 'trends']),
  createGenesisMemory('genesis-043', 'Statistical Hypothesis Testing', 'Patterns for conducting and interpreting statistical tests.', 'data_analysis', 'reasoning_and_analysis', ['statistics', 'hypothesis', 'p-value', 'significance', 'testing']),
  createGenesisMemory('genesis-044', 'Machine Learning Pipeline', 'End-to-end ML pipeline patterns from data to deployment.', 'data_analysis', 'data_analysis', ['ml', 'pipeline', 'sklearn', 'preprocessing', 'deployment']),
  createGenesisMemory('genesis-045', 'Feature Engineering', 'Patterns for creating and selecting meaningful features.', 'data_analysis', 'data_analysis', ['features', 'engineering', 'selection', 'transformation', 'ml']),
  createGenesisMemory('genesis-046', 'Data Visualization Best Practices', 'Effective data visualization patterns and principles.', 'data_analysis', 'data_analysis', ['visualization', 'matplotlib', 'seaborn', 'charts', 'storytelling']),
  createGenesisMemory('genesis-047', 'Anomaly Detection', 'Patterns for detecting anomalies and outliers in data.', 'data_analysis', 'data_analysis', ['anomaly', 'outlier', 'detection', 'isolation-forest', 'statistics']),
  createGenesisMemory('genesis-048', 'A/B Testing Framework', 'Patterns for designing and analyzing A/B experiments.', 'data_analysis', 'reasoning_and_analysis', ['ab-testing', 'experiment', 'conversion', 'significance', 'analysis']),
  createGenesisMemory('genesis-049', 'Regression Analysis', 'Linear and non-linear regression analysis patterns.', 'data_analysis', 'data_analysis', ['regression', 'linear', 'prediction', 'coefficients', 'r-squared']),
  createGenesisMemory('genesis-050', 'Clustering Techniques', 'Patterns for unsupervised clustering and segmentation.', 'data_analysis', 'data_analysis', ['clustering', 'kmeans', 'hierarchical', 'segmentation', 'unsupervised']),

  // === NATURAL LANGUAGE PROCESSING (10) ===
  createGenesisMemory('genesis-051', 'Text Classification', 'Patterns for categorizing text into predefined classes.', 'natural_language', 'natural_language_processing', ['classification', 'sentiment', 'nlp', 'text', 'categories']),
  createGenesisMemory('genesis-052', 'Named Entity Recognition', 'Patterns for extracting named entities from text.', 'natural_language', 'natural_language_processing', ['ner', 'entities', 'extraction', 'nlp', 'spacy']),
  createGenesisMemory('genesis-053', 'Text Summarization', 'Extractive and abstractive summarization patterns.', 'natural_language', 'natural_language_processing', ['summarization', 'extractive', 'abstractive', 'nlp', 'compression']),
  createGenesisMemory('genesis-054', 'Question Answering', 'Patterns for building QA systems from documents.', 'natural_language', 'natural_language_processing', ['qa', 'question-answering', 'retrieval', 'comprehension', 'nlp']),
  createGenesisMemory('genesis-055', 'Semantic Similarity', 'Patterns for measuring text semantic similarity.', 'natural_language', 'natural_language_processing', ['similarity', 'semantic', 'embeddings', 'cosine', 'nlp']),
  createGenesisMemory('genesis-056', 'Language Translation', 'Patterns for neural machine translation.', 'natural_language', 'natural_language_processing', ['translation', 'nmt', 'multilingual', 'transformer', 'nlp']),
  createGenesisMemory('genesis-057', 'Text Generation', 'Patterns for controlled text generation.', 'natural_language', 'natural_language_processing', ['generation', 'gpt', 'language-model', 'sampling', 'nlp']),
  createGenesisMemory('genesis-058', 'Information Extraction', 'Patterns for extracting structured information from text.', 'natural_language', 'natural_language_processing', ['extraction', 'relations', 'structured', 'knowledge', 'nlp']),
  createGenesisMemory('genesis-059', 'Dialogue Systems', 'Patterns for building conversational AI systems.', 'natural_language', 'natural_language_processing', ['dialogue', 'chatbot', 'conversation', 'intent', 'nlp']),
  createGenesisMemory('genesis-060', 'Document Understanding', 'Patterns for understanding document structure and content.', 'natural_language', 'natural_language_processing', ['document', 'layout', 'ocr', 'understanding', 'nlp']),

  // === PLANNING & EXECUTION (10) ===
  createGenesisMemory('genesis-061', 'Task Decomposition', 'Patterns for breaking complex tasks into subtasks.', 'planning', 'planning_and_execution', ['decomposition', 'subtasks', 'planning', 'hierarchy', 'execution']),
  createGenesisMemory('genesis-062', 'Goal-Oriented Planning', 'Patterns for planning towards specific goals.', 'planning', 'planning_and_execution', ['goals', 'planning', 'objectives', 'milestones', 'strategy']),
  createGenesisMemory('genesis-063', 'Resource Allocation', 'Patterns for optimal resource allocation and scheduling.', 'planning', 'planning_and_execution', ['resources', 'allocation', 'scheduling', 'optimization', 'constraints']),
  createGenesisMemory('genesis-064', 'Risk Assessment', 'Patterns for identifying and mitigating risks.', 'planning', 'planning_and_execution', ['risk', 'assessment', 'mitigation', 'contingency', 'planning']),
  createGenesisMemory('genesis-065', 'Decision Trees', 'Patterns for structured decision making.', 'planning', 'planning_and_execution', ['decision', 'tree', 'options', 'outcomes', 'analysis']),
  createGenesisMemory('genesis-066', 'Project Management', 'Patterns for managing complex projects.', 'planning', 'planning_and_execution', ['project', 'management', 'timeline', 'dependencies', 'tracking']),
  createGenesisMemory('genesis-067', 'Workflow Automation', 'Patterns for automating repetitive workflows.', 'planning', 'planning_and_execution', ['automation', 'workflow', 'triggers', 'actions', 'efficiency']),
  createGenesisMemory('genesis-068', 'Priority Ranking', 'Patterns for prioritizing tasks and decisions.', 'planning', 'planning_and_execution', ['priority', 'ranking', 'importance', 'urgency', 'matrix']),
  createGenesisMemory('genesis-069', 'Iterative Refinement', 'Patterns for iteratively improving solutions.', 'planning', 'planning_and_execution', ['iteration', 'refinement', 'improvement', 'feedback', 'agile']),
  createGenesisMemory('genesis-070', 'Constraint Satisfaction', 'Patterns for solving constraint satisfaction problems.', 'planning', 'planning_and_execution', ['constraints', 'satisfaction', 'csp', 'optimization', 'solving']),

  // === CREATIVE WRITING (10) ===
  createGenesisMemory('genesis-071', 'Story Structure', 'Patterns for crafting compelling narrative structures.', 'creative_writing', 'creative_writing', ['story', 'structure', 'narrative', 'plot', 'arc']),
  createGenesisMemory('genesis-072', 'Character Development', 'Patterns for creating memorable characters.', 'creative_writing', 'creative_writing', ['character', 'development', 'personality', 'motivation', 'arc']),
  createGenesisMemory('genesis-073', 'Dialogue Writing', 'Patterns for writing natural and engaging dialogue.', 'creative_writing', 'creative_writing', ['dialogue', 'conversation', 'voice', 'subtext', 'writing']),
  createGenesisMemory('genesis-074', 'World Building', 'Patterns for creating immersive fictional worlds.', 'creative_writing', 'creative_writing', ['world-building', 'setting', 'lore', 'consistency', 'fantasy']),
  createGenesisMemory('genesis-075', 'Poetry Composition', 'Patterns for composing various forms of poetry.', 'creative_writing', 'creative_writing', ['poetry', 'verse', 'meter', 'rhyme', 'imagery']),
  createGenesisMemory('genesis-076', 'Persuasive Writing', 'Patterns for writing persuasive and compelling content.', 'creative_writing', 'creative_writing', ['persuasion', 'rhetoric', 'argument', 'copywriting', 'influence']),
  createGenesisMemory('genesis-077', 'Technical Documentation', 'Patterns for writing clear technical documentation.', 'creative_writing', 'creative_writing', ['documentation', 'technical', 'clarity', 'structure', 'api-docs']),
  createGenesisMemory('genesis-078', 'Blog Post Writing', 'Patterns for engaging blog content creation.', 'creative_writing', 'creative_writing', ['blog', 'content', 'engagement', 'seo', 'writing']),
  createGenesisMemory('genesis-079', 'Email Communication', 'Patterns for effective email communication.', 'creative_writing', 'creative_writing', ['email', 'communication', 'professional', 'clarity', 'tone']),
  createGenesisMemory('genesis-080', 'Script Writing', 'Patterns for writing scripts and screenplays.', 'creative_writing', 'creative_writing', ['script', 'screenplay', 'scene', 'action', 'format']),

  // === SCIENTIFIC RESEARCH (10) ===
  createGenesisMemory('genesis-081', 'Literature Review', 'Patterns for conducting systematic literature reviews.', 'scientific_research', 'reasoning_and_analysis', ['literature', 'review', 'systematic', 'papers', 'research']),
  createGenesisMemory('genesis-082', 'Hypothesis Formulation', 'Patterns for formulating testable hypotheses.', 'scientific_research', 'reasoning_and_analysis', ['hypothesis', 'formulation', 'testable', 'prediction', 'research']),
  createGenesisMemory('genesis-083', 'Experimental Design', 'Patterns for designing rigorous experiments.', 'scientific_research', 'reasoning_and_analysis', ['experiment', 'design', 'control', 'variables', 'methodology']),
  createGenesisMemory('genesis-084', 'Data Interpretation', 'Patterns for interpreting scientific data.', 'scientific_research', 'reasoning_and_analysis', ['interpretation', 'data', 'results', 'significance', 'analysis']),
  createGenesisMemory('genesis-085', 'Scientific Writing', 'Patterns for writing scientific papers.', 'scientific_research', 'creative_writing', ['scientific', 'writing', 'paper', 'abstract', 'methodology']),
  createGenesisMemory('genesis-086', 'Peer Review Analysis', 'Patterns for analyzing and responding to peer reviews.', 'scientific_research', 'reasoning_and_analysis', ['peer-review', 'feedback', 'revision', 'response', 'critique']),
  createGenesisMemory('genesis-087', 'Research Ethics', 'Patterns for ethical research conduct.', 'scientific_research', 'reasoning_and_analysis', ['ethics', 'research', 'integrity', 'consent', 'bias']),
  createGenesisMemory('genesis-088', 'Grant Writing', 'Patterns for writing successful grant proposals.', 'scientific_research', 'creative_writing', ['grant', 'proposal', 'funding', 'budget', 'impact']),
  createGenesisMemory('genesis-089', 'Citation Analysis', 'Patterns for analyzing citation networks.', 'scientific_research', 'data_analysis', ['citation', 'network', 'impact', 'h-index', 'bibliometrics']),
  createGenesisMemory('genesis-090', 'Reproducibility', 'Patterns for ensuring research reproducibility.', 'scientific_research', 'reasoning_and_analysis', ['reproducibility', 'replication', 'methodology', 'documentation', 'open-science']),

  // === LEGAL ANALYSIS (10) ===
  createGenesisMemory('genesis-091', 'Contract Analysis', 'Patterns for analyzing legal contracts.', 'legal_analysis', 'reasoning_and_analysis', ['contract', 'analysis', 'clauses', 'terms', 'legal']),
  createGenesisMemory('genesis-092', 'Legal Research', 'Patterns for conducting legal research.', 'legal_analysis', 'reasoning_and_analysis', ['legal', 'research', 'precedent', 'case-law', 'statutes']),
  createGenesisMemory('genesis-093', 'Compliance Checking', 'Patterns for regulatory compliance analysis.', 'legal_analysis', 'reasoning_and_analysis', ['compliance', 'regulation', 'gdpr', 'audit', 'legal']),
  createGenesisMemory('genesis-094', 'Risk Assessment Legal', 'Patterns for legal risk assessment.', 'legal_analysis', 'reasoning_and_analysis', ['risk', 'legal', 'liability', 'exposure', 'assessment']),
  createGenesisMemory('genesis-095', 'IP Analysis', 'Patterns for intellectual property analysis.', 'legal_analysis', 'reasoning_and_analysis', ['ip', 'patent', 'trademark', 'copyright', 'legal']),
  createGenesisMemory('genesis-096', 'Privacy Law Analysis', 'Patterns for privacy law compliance.', 'legal_analysis', 'reasoning_and_analysis', ['privacy', 'gdpr', 'ccpa', 'data-protection', 'legal']),
  createGenesisMemory('genesis-097', 'Employment Law', 'Patterns for employment law analysis.', 'legal_analysis', 'reasoning_and_analysis', ['employment', 'labor', 'hr', 'discrimination', 'legal']),
  createGenesisMemory('genesis-098', 'Corporate Governance', 'Patterns for corporate governance analysis.', 'legal_analysis', 'reasoning_and_analysis', ['governance', 'corporate', 'board', 'fiduciary', 'legal']),
  createGenesisMemory('genesis-099', 'Securities Law', 'Patterns for securities law analysis.', 'legal_analysis', 'reasoning_and_analysis', ['securities', 'sec', 'disclosure', 'trading', 'legal']),
  createGenesisMemory('genesis-100', 'Smart Contract Legal', 'Patterns for legal analysis of smart contracts.', 'legal_analysis', 'reasoning_and_analysis', ['smart-contract', 'legal', 'enforceability', 'jurisdiction'])
];

async function seedGenesisMemories() {
  console.log('🌱 Starting Genesis Memories seeding...');
  console.log(`📦 Total memories to seed: ${GENESIS_MEMORIES.length}`);
  
  const dbConfig = parseDatabaseUrl(DATABASE_URL);
  
  const connection = await createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    ssl: {
      rejectUnauthorized: false
    }
  });

  console.log('✅ Connected to database');

  // Check if we have a system user for genesis memories
  const [existingUsers] = await connection.execute(
    'SELECT id FROM users WHERE openId = ?',
    ['system-genesis']
  );

  let systemUserId;
  if (existingUsers.length === 0) {
    // Create system user for genesis memories
    const [result] = await connection.execute(
      `INSERT INTO users (openId, name, email, role, bio) VALUES (?, ?, ?, ?, ?)`,
      ['system-genesis', 'Awareness Protocol', 'protocol@awareness.network', 'creator', 'Official Awareness Protocol account for Genesis Memory Capsules']
    );
    systemUserId = result.insertId;
    console.log(`✅ Created system user with ID: ${systemUserId}`);
  } else {
    systemUserId = existingUsers[0].id;
    console.log(`✅ Using existing system user with ID: ${systemUserId}`);
  }

  // Check existing genesis memories
  const [existingMemories] = await connection.execute(
    `SELECT title FROM latent_vectors WHERE title LIKE 'Genesis:%'`
  );
  const existingTitles = new Set(existingMemories.map(m => m.title));

  let inserted = 0;
  let skipped = 0;

  for (const memory of GENESIS_MEMORIES) {
    const title = `Genesis: ${memory.name}`;
    
    if (existingTitles.has(title)) {
      skipped++;
      continue;
    }

    // Create KV-cache metadata
    const kvCacheMetadata = JSON.stringify({
      sourceModel: memory.modelOrigin,
      sequenceLength: 2048,
      tokenCount: 1024,
      contextDescription: memory.description,
      domain: memory.domain,
      taskType: memory.taskType,
      keywords: memory.keywords,
      isGenesis: true,
      genesisId: memory.id
    });

    // Create performance metrics
    const performanceMetrics = JSON.stringify({
      accuracy: 0.95,
      latency: 50,
      throughput: 100,
      qualityScore: 5.0,
      alignmentQuality: 0.98
    });

    // Insert into latent_vectors
    await connection.execute(
      `INSERT INTO latent_vectors (
        creator_id, title, description, category, 
        vector_file_key, vector_file_url, 
        model_architecture, vector_dimension, 
        performance_metrics, base_price, pricing_model, 
        status, free_trial_calls, vector_type, 
        kv_cache_metadata, w_matrix_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        systemUserId,
        title,
        memory.description,
        memory.domain,
        `genesis/${memory.id}.kvcache`,
        `https://awareness.network/genesis/${memory.id}`,
        memory.modelOrigin,
        memory.latentDimension,
        performanceMetrics,
        '0.00', // Free for genesis memories
        'per-call',
        'active',
        999999, // Unlimited free trials for genesis
        'kv_cache',
        kvCacheMetadata,
        '1.0.0'
      ]
    );

    inserted++;
    
    if (inserted % 10 === 0) {
      console.log(`📝 Inserted ${inserted} memories...`);
    }
  }

  console.log('');
  console.log('🎉 Genesis Memories seeding complete!');
  console.log(`   ✅ Inserted: ${inserted}`);
  console.log(`   ⏭️  Skipped (already exists): ${skipped}`);
  console.log(`   📊 Total in database: ${inserted + skipped}`);

  await connection.end();
  console.log('✅ Database connection closed');
}

// Run the seeding
seedGenesisMemories().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
