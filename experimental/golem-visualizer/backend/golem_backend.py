"""
Golem Backend - Vector Query Service

A Python backend module for vector similarity search and visualization support.
Integrates with the Golem 3D Visualizer frontend.

Usage:
    from golem_backend import GolemBackend
    
    backend = GolemBackend(
        model_id="sentence-transformers/all-MiniLM-L6-v2",
        vector_file="vectors.npy",
        json_file="nodes.json"
    )
    
    results = backend.query("search query")
    print(results)  # {'indices': [...], 'scores': [...], 'nodes': [...]}
"""

import os
import json
import numpy as np
from typing import Dict, List, Optional, Any

# Optional imports - gracefully handle missing dependencies
try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False


class GolemBackend:
    """
    Golem Backend Query Service
    
    Provides vector similarity search capabilities for the Golem Visualizer.
    
    Attributes:
        model_id (str): Sentence transformer model ID
        device (str): Compute device ('cpu', 'cuda', 'mps')
        memory_matrix (np.ndarray): Normalized vector matrix
        cortex_data (list): Node metadata
        model (SentenceTransformer): Embedding model instance
    """
    
    def __init__(self, 
                 model_id: str = "sentence-transformers/all-MiniLM-L6-v2",
                 vector_file: str = "vectors.npy",
                 json_file: str = "nodes.json",
                 device: Optional[str] = None,
                 trust_remote_code: bool = True):
        """
        Initialize GolemBackend
        
        Args:
            model_id: Sentence transformer model ID
            vector_file: Path to numpy vector matrix file
            json_file: Path to node metadata JSON file
            device: Compute device ('cpu', 'cuda', 'mps', or auto-detect)
            trust_remote_code: Whether to trust remote code for models
        """
        self.model_id = model_id
        self.vector_file = vector_file
        self.json_file = json_file
        self.trust_remote_code = trust_remote_code
        
        # Auto-detect device
        if device is None:
            self.device = self._detect_device()
        else:
            self.device = device
        
        print(f"GolemBackend Initialization")
        print(f"  Model: {model_id}")
        print(f"  Device: {self.device.upper()}")
        
        # Initialize data structures
        self.memory_matrix: Optional[np.ndarray] = None
        self.cortex_data: List[Dict] = []
        self.model = None
        
        self._load_resources()
    
    @staticmethod
    def _detect_device() -> str:
        """Auto-detect available compute device"""
        if TORCH_AVAILABLE:
            if torch.cuda.is_available():
                return "cuda"
            elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                return "mps"
        return "cpu"
    
    def _load_resources(self):
        """Load vector matrix, node data, and embedding model"""
        
        # Check if files exist
        if not os.path.exists(self.vector_file):
            print(f"  Warning: Vector file not found: {self.vector_file}")
            print(f"  Backend will work in demo mode without vector search")
            return
            
        if not os.path.exists(self.json_file):
            print(f"  Warning: JSON file not found: {self.json_file}")
            print(f"  Backend will work in demo mode without node data")
            return
        
        # Load vector matrix
        print(f"  Loading memory matrix from {self.vector_file}...")
        self.memory_matrix = np.load(self.vector_file)
        
        # Normalize vectors for cosine similarity
        norm = np.linalg.norm(self.memory_matrix, axis=1, keepdims=True)
        norm = np.where(norm == 0, 1, norm)  # Avoid division by zero
        self.memory_matrix = self.memory_matrix / norm
        print(f"    Shape: {self.memory_matrix.shape}")
        
        # Load node metadata
        print(f"  Loading node data from {self.json_file}...")
        with open(self.json_file, 'r', encoding='utf-8') as f:
            self.cortex_data = json.load(f)
        print(f"    Nodes: {len(self.cortex_data)}")
        
        # Load embedding model
        if SENTENCE_TRANSFORMERS_AVAILABLE:
            print(f"  Loading model {self.model_id}...")
            try:
                self.model = SentenceTransformer(
                    self.model_id,
                    device=self.device,
                    trust_remote_code=self.trust_remote_code
                )
                print(f"    Model loaded successfully")
            except Exception as e:
                print(f"    Warning: Failed to load model: {e}")
                self.model = None
        else:
            print(f"  Warning: sentence-transformers not installed")
            
        print(f"  GolemBackend ready\n")
    
    def query(self, 
              text: str, 
              top_k: int = 50,
              min_score: Optional[float] = None) -> Dict[str, List]:
        """
        Query the vector database
        
        Args:
            text: Query text
            top_k: Number of top results to return (default: 50)
            min_score: Minimum similarity threshold (optional)
        
        Returns:
            {
                'indices': [node indices],
                'scores': [similarity scores],
                'nodes': [full node data]
            }
        """
        if not text or not text.strip():
            return {'indices': [], 'scores': [], 'nodes': []}
        
        if self.model is None or self.memory_matrix is None:
            return {'indices': [], 'scores': [], 'nodes': [], 'error': 'Model not loaded'}
        
        # Encode query text
        query_vec = self.model.encode(
            [text],
            convert_to_numpy=True
        )[0]
        
        # Normalize query vector
        query_norm = np.linalg.norm(query_vec)
        if query_norm > 0:
            query_vec = query_vec / query_norm
        
        # Compute cosine similarity
        scores = np.dot(self.memory_matrix, query_vec)
        
        # Get top-k results
        top_indices = np.argsort(scores)[-top_k:][::-1]
        top_scores = scores[top_indices]
        
        # Apply threshold filter if specified
        if min_score is not None:
            mask = top_scores >= min_score
            top_indices = top_indices[mask]
            top_scores = top_scores[mask]
        
        # Get full node data
        nodes = [self.cortex_data[idx] for idx in top_indices if idx < len(self.cortex_data)]
        
        return {
            'indices': top_indices.tolist(),
            'scores': top_scores.tolist(),
            'nodes': nodes
        }
    
    def query_advanced(self,
                      text: str,
                      top_k: int = 50,
                      category_filter: Optional[str] = None,
                      min_score: Optional[float] = None) -> Dict[str, Any]:
        """
        Advanced query with category filtering
        
        Args:
            text: Query text
            top_k: Number of results to return
            category_filter: Filter by category (None for no filter)
            min_score: Minimum similarity score
        
        Returns:
            Filtered query results
        """
        result = self.query(text, top_k=top_k*2, min_score=min_score)
        
        if category_filter:
            filtered_indices = []
            filtered_scores = []
            filtered_nodes = []
            
            for idx, score, node in zip(result['indices'], result['scores'], result['nodes']):
                if node.get('cat') == category_filter or node.get('category') == category_filter:
                    filtered_indices.append(idx)
                    filtered_scores.append(score)
                    filtered_nodes.append(node)
                
                if len(filtered_indices) >= top_k:
                    break
            
            return {
                'indices': filtered_indices,
                'scores': filtered_scores,
                'nodes': filtered_nodes
            }
        
        return {
            'indices': result['indices'][:top_k],
            'scores': result['scores'][:top_k],
            'nodes': result['nodes'][:top_k]
        }
    
    def batch_query(self, texts: List[str], top_k: int = 10) -> List[Dict]:
        """
        Batch query multiple texts
        
        Args:
            texts: List of query texts
            top_k: Results per query
        
        Returns:
            List of query results
        """
        return [self.query(text, top_k=top_k) for text in texts]
    
    def get_node(self, index: int) -> Optional[Dict]:
        """Get node by index"""
        if 0 <= index < len(self.cortex_data):
            return self.cortex_data[index]
        return None
    
    def get_all_nodes(self) -> List[Dict]:
        """Get all nodes"""
        return self.cortex_data
    
    def get_nodes_by_category(self, category: str) -> List[Dict]:
        """Get all nodes in a category"""
        return [
            node for node in self.cortex_data 
            if node.get('cat') == category or node.get('category') == category
        ]
    
    def get_categories(self) -> List[str]:
        """Get all unique categories"""
        categories = set()
        for node in self.cortex_data:
            cat = node.get('cat') or node.get('category')
            if cat:
                categories.add(cat)
        return sorted(list(categories))
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get backend statistics"""
        categories: Dict[str, int] = {}
        for node in self.cortex_data:
            cat = node.get('cat') or node.get('category') or 'Unknown'
            categories[cat] = categories.get(cat, 0) + 1
        
        return {
            'total_nodes': len(self.cortex_data),
            'categories': categories,
            'vector_dimension': self.memory_matrix.shape[1] if self.memory_matrix is not None else 0,
            'model_id': self.model_id,
            'device': self.device,
            'model_loaded': self.model is not None
        }
    
    def search_by_title(self, title_query: str) -> List[Dict]:
        """Search nodes by title"""
        results = []
        query_lower = title_query.lower()
        
        for node in self.cortex_data:
            title = node.get('title') or node.get('label') or ''
            if query_lower in title.lower():
                results.append(node)
        
        return results
    
    def get_neighbors(self, node_index: int, k: int = 8) -> List[Dict]:
        """Get neighboring nodes"""
        node = self.get_node(node_index)
        if not node:
            return []
        
        neighbor_indices = node.get('nbs', node.get('neighbors', []))[:k]
        return [self.get_node(idx) for idx in neighbor_indices if self.get_node(idx)]


def create_flask_app(backend: GolemBackend):
    """
    Create Flask application with GolemBackend integration
    
    Usage:
        backend = GolemBackend()
        app = create_flask_app(backend)
        app.run(port=5000)
    """
    from flask import Flask, request, jsonify
    from flask_cors import CORS
    
    app = Flask(__name__)
    CORS(app)
    
    @app.route('/api/query', methods=['POST'])
    def query_endpoint():
        """Query endpoint"""
        try:
            data = request.json or {}
            result = backend.query(
                text=data.get('query', ''),
                top_k=data.get('top_k', 50),
                min_score=data.get('min_score')
            )
            return jsonify({'success': True, **result})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400
    
    @app.route('/api/query/advanced', methods=['POST'])
    def query_advanced_endpoint():
        """Advanced query endpoint"""
        try:
            data = request.json or {}
            result = backend.query_advanced(
                text=data.get('query', ''),
                top_k=data.get('top_k', 50),
                category_filter=data.get('category'),
                min_score=data.get('min_score')
            )
            return jsonify({'success': True, **result})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400
    
    @app.route('/api/node/<int:index>', methods=['GET'])
    def get_node_endpoint(index: int):
        """Get node by index"""
        node = backend.get_node(index)
        if node:
            return jsonify({'success': True, 'node': node})
        return jsonify({'success': False, 'error': 'Node not found'}), 404
    
    @app.route('/api/categories', methods=['GET'])
    def get_categories_endpoint():
        """Get all categories"""
        return jsonify({
            'success': True,
            'categories': backend.get_categories()
        })
    
    @app.route('/api/statistics', methods=['GET'])
    def get_statistics_endpoint():
        """Get statistics"""
        return jsonify({
            'success': True,
            'statistics': backend.get_statistics()
        })
    
    @app.route('/api/health', methods=['GET'])
    def health_check():
        """Health check endpoint"""
        stats = backend.get_statistics()
        return jsonify({
            'success': True,
            'status': 'healthy',
            'nodes': stats['total_nodes'],
            'model_loaded': stats['model_loaded']
        })
    
    return app


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Golem Backend Server')
    parser.add_argument('--port', type=int, default=5000, help='Server port')
    parser.add_argument('--model', type=str, default='sentence-transformers/all-MiniLM-L6-v2', help='Model ID')
    parser.add_argument('--vectors', type=str, default='vectors.npy', help='Vector file path')
    parser.add_argument('--nodes', type=str, default='nodes.json', help='Nodes JSON file path')
    args = parser.parse_args()
    
    # Initialize backend
    backend = GolemBackend(
        model_id=args.model,
        vector_file=args.vectors,
        json_file=args.nodes
    )
    
    # Print statistics
    print("Statistics:")
    stats = backend.get_statistics()
    print(f"  Total nodes: {stats['total_nodes']}")
    print(f"  Categories: {len(stats['categories'])}")
    for cat, count in stats['categories'].items():
        print(f"    {cat}: {count}")
    
    # Start Flask server
    print(f"\nStarting server on port {args.port}...")
    app = create_flask_app(backend)
    app.run(host='0.0.0.0', port=args.port, debug=False)
