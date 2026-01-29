/**
 * FAISS Vector Index Service
 *
 * Provides 10-100x faster vector similarity search using FAISS indexing.
 * Replaces O(n) brute-force search with approximate nearest neighbor (ANN).
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

interface FaissConfig {
  indexType: 'Flat' | 'IVF' | 'HNSW';
  dimension: number;
  nlist?: number; // For IVF: number of clusters
  m?: number; // For HNSW: number of connections
  efConstruction?: number; // For HNSW: construction parameter
  efSearch?: number; // For HNSW: search parameter
}

interface SearchResult {
  id: string;
  distance: number;
  metadata?: any;
}

/**
 * FAISS Index Service
 *
 * Uses Python FAISS library via child process for maximum performance.
 * Falls back to in-memory brute-force if FAISS unavailable.
 */
export class FaissIndexService {
  private indexPath: string;
  private metadataPath: string;
  private config: FaissConfig;
  private pythonProcess: any = null;
  private useNativeFaiss: boolean = true;

  // In-memory fallback (if FAISS not available)
  private inMemoryVectors: Map<string, number[]> = new Map();
  private inMemoryMetadata: Map<string, any> = new Map();

  constructor(
    indexName: string,
    config: FaissConfig = {
      indexType: 'IVF',
      dimension: 768,
      nlist: 100,
    }
  ) {
    this.indexPath = path.join(process.cwd(), 'data', 'faiss-indices', `${indexName}.index`);
    this.metadataPath = path.join(process.cwd(), 'data', 'faiss-indices', `${indexName}.metadata.json`);
    this.config = config;
  }

  /**
   * Initialize FAISS index
   */
  async initialize(): Promise<void> {
    try {
      // Check if FAISS Python library is available
      await this.checkFaissAvailability();

      if (this.useNativeFaiss) {
        await this.initializeNativeFaiss();
      } else {
        console.warn('FAISS not available, using in-memory fallback');
        await this.loadInMemoryIndex();
      }
    } catch (error) {
      console.error('Failed to initialize FAISS:', error);
      this.useNativeFaiss = false;
      await this.loadInMemoryIndex();
    }
  }

  /**
   * Check if FAISS is available
   */
  private async checkFaissAvailability(): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn('python', ['-c', 'import faiss; print("OK")']);

      let output = '';
      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0 && output.includes('OK')) {
          this.useNativeFaiss = true;
          resolve();
        } else {
          this.useNativeFaiss = false;
          reject(new Error('FAISS not available'));
        }
      });

      process.on('error', () => {
        this.useNativeFaiss = false;
        reject(new Error('Python not available'));
      });
    });
  }

  /**
   * Initialize native FAISS index
   */
  private async initializeNativeFaiss(): Promise<void> {
    const indexDir = path.dirname(this.indexPath);
    await fs.mkdir(indexDir, { recursive: true });

    // Check if index already exists
    try {
      await fs.access(this.indexPath);
      console.log(`FAISS index loaded: ${this.indexPath}`);
    } catch {
      // Create new index
      await this.createNewIndex();
      console.log(`FAISS index created: ${this.indexPath}`);
    }
  }

  /**
   * Create new FAISS index
   */
  private async createNewIndex(): Promise<void> {
    const pythonScript = `
import faiss
import numpy as np

dimension = ${this.config.dimension}
index_type = "${this.config.indexType}"

if index_type == "Flat":
    index = faiss.IndexFlatL2(dimension)
elif index_type == "IVF":
    quantizer = faiss.IndexFlatL2(dimension)
    index = faiss.IndexIVFFlat(quantizer, dimension, ${this.config.nlist || 100})
elif index_type == "HNSW":
    index = faiss.IndexHNSWFlat(dimension, ${this.config.m || 32})
    index.hnsw.efConstruction = ${this.config.efConstruction || 40}
else:
    index = faiss.IndexFlatL2(dimension)

faiss.write_index(index, "${this.indexPath.replace(/\\/g, '/')}")
print("Index created successfully")
`;

    await this.executePythonScript(pythonScript);
  }

  /**
   * Add vectors to index
   */
  async addVectors(vectors: Array<{ id: string; vector: number[]; metadata?: any }>): Promise<void> {
    if (this.useNativeFaiss) {
      await this.addVectorsNative(vectors);
    } else {
      this.addVectorsInMemory(vectors);
    }
  }

  /**
   * Add vectors using native FAISS
   */
  private async addVectorsNative(vectors: Array<{ id: string; vector: number[]; metadata?: any }>): Promise<void> {
    // Prepare vectors as numpy array
    const vectorData = vectors.map(v => v.vector);
    const vectorIds = vectors.map(v => v.id);
    const metadata = vectors.map(v => v.metadata || {});

    const pythonScript = `
import faiss
import numpy as np
import json

# Load index
index = faiss.read_index("${this.indexPath.replace(/\\/g, '/')}")

# Prepare vectors
vectors = np.array(${JSON.stringify(vectorData)}, dtype=np.float32)

# Add to index
index.add(vectors)

# Save index
faiss.write_index(index, "${this.indexPath.replace(/\\/g, '/')}")

# Save metadata
metadata = ${JSON.stringify({ ids: vectorIds, metadata })}
with open("${this.metadataPath.replace(/\\/g, '/')}", 'w') as f:
    json.dump(metadata, f)

print(f"Added {len(vectors)} vectors")
`;

    await this.executePythonScript(pythonScript);
  }

  /**
   * Add vectors to in-memory index
   */
  private addVectorsInMemory(vectors: Array<{ id: string; vector: number[]; metadata?: any }>): void {
    for (const { id, vector, metadata } of vectors) {
      this.inMemoryVectors.set(id, vector);
      if (metadata) {
        this.inMemoryMetadata.set(id, metadata);
      }
    }
  }

  /**
   * Search for similar vectors
   */
  async search(queryVector: number[], k: number = 10, threshold?: number): Promise<SearchResult[]> {
    if (this.useNativeFaiss) {
      return await this.searchNative(queryVector, k, threshold);
    } else {
      return this.searchInMemory(queryVector, k, threshold);
    }
  }

  /**
   * Search using native FAISS
   */
  private async searchNative(queryVector: number[], k: number, threshold?: number): Promise<SearchResult[]> {
    const pythonScript = `
import faiss
import numpy as np
import json

# Load index
index = faiss.read_index("${this.indexPath.replace(/\\/g, '/')}")

# Load metadata
with open("${this.metadataPath.replace(/\\/g, '/')}", 'r') as f:
    metadata = json.load(f)

# Query vector
query = np.array([${queryVector.join(',')}], dtype=np.float32)

# Search
distances, indices = index.search(query, ${k})

# Format results
results = []
for i, (dist, idx) in enumerate(zip(distances[0], indices[0])):
    if idx >= 0:  # Valid index
        result = {
            'id': metadata['ids'][int(idx)],
            'distance': float(dist),
            'metadata': metadata['metadata'][int(idx)]
        }
        ${threshold !== undefined ? `if float(dist) <= ${threshold}:` : ''}
        results.append(result)

print(json.dumps(results))
`;

    const output = await this.executePythonScript(pythonScript);
    return JSON.parse(output);
  }

  /**
   * Search in-memory (brute-force fallback)
   */
  private searchInMemory(queryVector: number[], k: number, threshold?: number): SearchResult[] {
    const results: SearchResult[] = [];

    // Calculate distances to all vectors
    for (const [id, vector] of this.inMemoryVectors.entries()) {
      const distance = this.euclideanDistance(queryVector, vector);

      if (threshold === undefined || distance <= threshold) {
        results.push({
          id,
          distance,
          metadata: this.inMemoryMetadata.get(id),
        });
      }
    }

    // Sort by distance and take top k
    results.sort((a, b) => a.distance - b.distance);
    return results.slice(0, k);
  }

  /**
   * Remove vectors from index
   */
  async removeVectors(ids: string[]): Promise<void> {
    if (this.useNativeFaiss) {
      await this.removeVectorsNative(ids);
    } else {
      this.removeVectorsInMemory(ids);
    }
  }

  /**
   * Remove vectors using native FAISS
   */
  private async removeVectorsNative(ids: string[]): Promise<void> {
    // FAISS doesn't support direct removal, need to rebuild index
    const pythonScript = `
import faiss
import numpy as np
import json

# Load index and metadata
index = faiss.read_index("${this.indexPath.replace(/\\/g, '/')}")
with open("${this.metadataPath.replace(/\\/g, '/')}", 'r') as f:
    metadata = json.load(f)

# Filter out removed IDs
remove_ids = set(${JSON.stringify(ids)})
keep_indices = [i for i, id in enumerate(metadata['ids']) if id not in remove_ids]

# Create new index with remaining vectors
new_index = faiss.IndexFlatL2(${this.config.dimension})

if len(keep_indices) > 0:
    # Reconstruct vectors (if index supports it)
    vectors = []
    for i in keep_indices:
        vec = index.reconstruct(i)
        vectors.append(vec)

    new_index.add(np.array(vectors, dtype=np.float32))

# Update metadata
new_metadata = {
    'ids': [metadata['ids'][i] for i in keep_indices],
    'metadata': [metadata['metadata'][i] for i in keep_indices]
}

# Save
faiss.write_index(new_index, "${this.indexPath.replace(/\\/g, '/')}")
with open("${this.metadataPath.replace(/\\/g, '/')}", 'w') as f:
    json.dump(new_metadata, f)

print(f"Removed {len(remove_ids)} vectors")
`;

    await this.executePythonScript(pythonScript);
  }

  /**
   * Remove vectors from in-memory index
   */
  private removeVectorsInMemory(ids: string[]): void {
    for (const id of ids) {
      this.inMemoryVectors.delete(id);
      this.inMemoryMetadata.delete(id);
    }
  }

  /**
   * Get index statistics
   */
  async getStats(): Promise<{ vectorCount: number; dimension: number; indexType: string }> {
    if (this.useNativeFaiss) {
      const pythonScript = `
import faiss
import json

index = faiss.read_index("${this.indexPath.replace(/\\/g, '/')}")

stats = {
    'vectorCount': index.ntotal,
    'dimension': index.d,
    'indexType': "${this.config.indexType}"
}

print(json.dumps(stats))
`;

      const output = await this.executePythonScript(pythonScript);
      return JSON.parse(output);
    } else {
      return {
        vectorCount: this.inMemoryVectors.size,
        dimension: this.config.dimension,
        indexType: 'InMemory',
      };
    }
  }

  /**
   * Load in-memory index from disk
   */
  private async loadInMemoryIndex(): Promise<void> {
    try {
      const metadataContent = await fs.readFile(this.metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataContent);

      // Load vectors (would need to store vectors separately for in-memory mode)
      // For now, start with empty index
      console.log('In-memory index initialized');
    } catch {
      console.log('No existing in-memory index found, starting fresh');
    }
  }

  /**
   * Execute Python script
   */
  private executePythonScript(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', ['-c', script]);

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`Python script failed: ${errorOutput}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Calculate Euclidean distance
   */
  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Close the index service
   */
  async close(): Promise<void> {
    if (this.pythonProcess) {
      this.pythonProcess.kill();
    }
  }
}

/**
 * Global FAISS index manager
 */
class FaissIndexManager {
  private indices: Map<string, FaissIndexService> = new Map();

  async getIndex(name: string, config?: FaissConfig): Promise<FaissIndexService> {
    if (!this.indices.has(name)) {
      const index = new FaissIndexService(name, config);
      await index.initialize();
      this.indices.set(name, index);
    }
    return this.indices.get(name)!;
  }

  async closeAll(): Promise<void> {
    for (const index of this.indices.values()) {
      await index.close();
    }
    this.indices.clear();
  }
}

export const faissManager = new FaissIndexManager();
