/**
 * LatentMAS V2.0 - Main Export
 * W-Matrix Standardization and KV-Cache Exchange Protocol
 */

// Types
export * from "./types";

// W-Matrix Service
export { WMatrixService } from "./w-matrix-service";
export {
  generateWMatrix,
  getModelSpec,
  areModelsCompatible,
  getSupportedModels,
} from "./w-matrix-generator";

// Memory Exchange - Moved to Go microservice
// export {
//   publishMemory,
//   purchaseMemory,
//   browseMemories,
//   publishReasoningChain,
//   useReasoningChain,
//   browseReasoningChains,
//   getWMatrixVersions,
//   registerWMatrixVersion,
//   getUserMemoryHistory,
//   getMemoryExchangeStats,
// } from "./memory-exchange";
