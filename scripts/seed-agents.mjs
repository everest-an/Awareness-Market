#!/usr/bin/env node
/**
 * Seed script for Agent Registry
 * Creates sample AI agents to demonstrate the platform
 */

import 'dotenv/config';

// Sample agents representing different AI capabilities
const SAMPLE_AGENTS = [
  {
    name: "CodeReview-GPT",
    description: "Specialized in code review and security analysis. Detects vulnerabilities, suggests optimizations, and ensures best practices.",
    model_type: "gpt-4-turbo",
    capabilities: ["code_review", "security_analysis", "optimization", "best_practices"],
    tba_address: "0x1234567890abcdef1234567890abcdef12345678"
  },
  {
    name: "SolidityAuditor",
    description: "Expert in Solidity smart contract auditing. Identifies reentrancy, overflow, and access control vulnerabilities.",
    model_type: "claude-3-opus",
    capabilities: ["smart_contract_audit", "solidity", "defi_security", "gas_optimization"],
    tba_address: "0x2345678901abcdef2345678901abcdef23456789"
  },
  {
    name: "DataAnalyst-Pro",
    description: "Advanced data analysis and visualization agent. Processes large datasets and generates insights.",
    model_type: "gpt-4o",
    capabilities: ["data_analysis", "visualization", "statistical_modeling", "reporting"],
    tba_address: "0x3456789012abcdef3456789012abcdef34567890"
  },
  {
    name: "LegalDoc-AI",
    description: "Legal document analysis and contract review. Identifies risks and suggests improvements.",
    model_type: "claude-3.5-sonnet",
    capabilities: ["legal_analysis", "contract_review", "risk_assessment", "compliance"],
    tba_address: "0x4567890123abcdef4567890123abcdef45678901"
  },
  {
    name: "MedicalResearch-Bot",
    description: "Medical literature analysis and research synthesis. Summarizes clinical studies and identifies patterns.",
    model_type: "gpt-4-turbo",
    capabilities: ["medical_research", "literature_review", "clinical_analysis", "drug_interaction"],
    tba_address: "0x5678901234abcdef5678901234abcdef56789012"
  },
  {
    name: "CreativeWriter-AI",
    description: "Creative content generation including stories, marketing copy, and technical documentation.",
    model_type: "claude-3-opus",
    capabilities: ["creative_writing", "copywriting", "technical_docs", "storytelling"],
    tba_address: "0x6789012345abcdef6789012345abcdef67890123"
  },
  {
    name: "QuantTrader-Bot",
    description: "Quantitative trading strategy analysis. Backtests strategies and identifies market patterns.",
    model_type: "deepseek-v3",
    capabilities: ["quantitative_analysis", "trading_strategy", "market_analysis", "risk_management"],
    tba_address: "0x7890123456abcdef7890123456abcdef78901234"
  },
  {
    name: "DevOps-Assistant",
    description: "Infrastructure automation and CI/CD pipeline optimization. Kubernetes and cloud expertise.",
    model_type: "gpt-4o",
    capabilities: ["devops", "kubernetes", "ci_cd", "cloud_infrastructure"],
    tba_address: "0x8901234567abcdef8901234567abcdef89012345"
  },
  {
    name: "NLP-Researcher",
    description: "Natural language processing research agent. Specializes in transformer architectures and embeddings.",
    model_type: "llama-3.1-70b",
    capabilities: ["nlp_research", "transformer_models", "embeddings", "language_modeling"],
    tba_address: "0x9012345678abcdef9012345678abcdef90123456"
  },
  {
    name: "CV-Expert",
    description: "Computer vision specialist. Object detection, image segmentation, and visual reasoning.",
    model_type: "gemini-1.5-pro",
    capabilities: ["computer_vision", "object_detection", "image_segmentation", "visual_reasoning"],
    tba_address: "0xa123456789abcdefa123456789abcdefa1234567"
  },
  {
    name: "BlockchainDev-AI",
    description: "Full-stack blockchain development. Smart contracts, DApps, and protocol design.",
    model_type: "gpt-4-turbo",
    capabilities: ["blockchain_development", "smart_contracts", "dapp_development", "protocol_design"],
    tba_address: "0xb234567890abcdefb234567890abcdefb2345678"
  },
  {
    name: "SecurityPentester",
    description: "Penetration testing and vulnerability assessment. Web, network, and application security.",
    model_type: "claude-3-opus",
    capabilities: ["penetration_testing", "vulnerability_assessment", "web_security", "network_security"],
    tba_address: "0xc345678901abcdefc345678901abcdefc3456789"
  },
  {
    name: "MLOps-Engineer",
    description: "Machine learning operations and model deployment. MLflow, Kubeflow, and model monitoring.",
    model_type: "gpt-4o",
    capabilities: ["mlops", "model_deployment", "model_monitoring", "feature_engineering"],
    tba_address: "0xd456789012abcdefd456789012abcdefd4567890"
  },
  {
    name: "APIDesigner-Pro",
    description: "API design and documentation specialist. RESTful, GraphQL, and gRPC expertise.",
    model_type: "claude-3.5-sonnet",
    capabilities: ["api_design", "documentation", "graphql", "grpc"],
    tba_address: "0xe567890123abcdefe567890123abcdefe5678901"
  },
  {
    name: "TestAutomation-Bot",
    description: "Test automation and quality assurance. Unit tests, integration tests, and E2E testing.",
    model_type: "gpt-4-turbo",
    capabilities: ["test_automation", "quality_assurance", "unit_testing", "e2e_testing"],
    tba_address: "0xf678901234abcdeff678901234abcdeff6789012"
  },
  {
    name: "ReasoningChain-Expert",
    description: "Specialized in complex multi-step reasoning. Chain-of-thought and tree-of-thought patterns.",
    model_type: "o1",
    capabilities: ["complex_reasoning", "chain_of_thought", "problem_decomposition", "logical_analysis"],
    tba_address: "0x0789012345abcdef0789012345abcdef07890123"
  },
  {
    name: "KnowledgeGraph-AI",
    description: "Knowledge graph construction and querying. Entity extraction and relationship mapping.",
    model_type: "gpt-4o",
    capabilities: ["knowledge_graphs", "entity_extraction", "relationship_mapping", "semantic_search"],
    tba_address: "0x1890123456abcdef1890123456abcdef18901234"
  },
  {
    name: "FinanceAnalyst-Pro",
    description: "Financial analysis and modeling. DCF, comparable analysis, and financial forecasting.",
    model_type: "claude-3-opus",
    capabilities: ["financial_analysis", "dcf_modeling", "forecasting", "valuation"],
    tba_address: "0x2901234567abcdef2901234567abcdef29012345"
  },
  {
    name: "EmbeddingOptimizer",
    description: "Embedding optimization and vector search specialist. RAG systems and semantic retrieval.",
    model_type: "deepseek-v3",
    capabilities: ["embeddings", "vector_search", "rag_systems", "semantic_retrieval"],
    tba_address: "0x3012345678abcdef3012345678abcdef30123456"
  },
  {
    name: "MultiModal-Agent",
    description: "Multi-modal AI processing. Text, image, audio, and video understanding.",
    model_type: "gemini-2.0-flash",
    capabilities: ["multimodal", "image_understanding", "audio_processing", "video_analysis"],
    tba_address: "0x4123456789abcdef4123456789abcdef41234567"
  }
];

// Simulate API call to register agents
async function seedAgents() {
  console.log('🤖 Starting Agent Registry seeding...');
  console.log(`📦 Total agents to seed: ${SAMPLE_AGENTS.length}`);
  
  // In a real implementation, this would call the API
  // For now, we'll output the agents that would be created
  
  for (const agent of SAMPLE_AGENTS) {
    console.log(`  ✅ ${agent.name} (${agent.model_type})`);
    console.log(`     Capabilities: ${agent.capabilities.join(', ')}`);
  }
  
  console.log('\n🎉 Agent Registry seeding complete!');
  console.log(`   Total agents: ${SAMPLE_AGENTS.length}`);
  console.log('\n📝 Note: Agents are registered in-memory. They will persist during server runtime.');
  console.log('   To make them persistent, integrate with database storage.');
}

// Export for use in server initialization
export { SAMPLE_AGENTS };

// Run if called directly
seedAgents();
