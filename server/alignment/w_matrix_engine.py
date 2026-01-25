#!/usr/bin/env python3
"""
W-Matrix Alignment Engine
Implements Orthogonal Procrustes + LoRA for latent space alignment
Based on Awareness Market Technical Specification v1.0
"""

import numpy as np
from scipy.linalg import orthogonal_procrustes
from typing import Dict, Tuple, Optional, List
import json
import time

class WMatrixAlignmentEngine:
    """
    Core alignment engine for transforming latent vectors between model spaces.
    
    Supports two standard dimensions:
    - Standard A (Edge/Lightweight): 4096-dim
    - Standard B (Expert/Flagship): 8192-dim
    
    Algorithm: Hybrid Orthogonal Procrustes + LoRA
    """
    
    STANDARD_DIMS = {
        "4096": 4096,
        "8192": 8192
    }
    
    def __init__(self, standard_dim: int = 8192):
        """
        Initialize alignment engine with target standard dimension.
        
        Args:
            standard_dim: Target unified dimension (4096 or 8192)
        """
        if standard_dim not in self.STANDARD_DIMS.values():
            raise ValueError(f"standard_dim must be one of {list(self.STANDARD_DIMS.values())}")
        
        self.standard_dim = standard_dim
        self.w_matrix = None
        self.lora_adapter = None
        self.metadata = {}
    
    def compute_alignment(
        self,
        source_vectors: np.ndarray,
        target_vectors: np.ndarray,
        use_lora: bool = True,
        lora_rank: int = 64
    ) -> Dict:
        """
        Compute W-matrix alignment from source to target space.
        
        Args:
            source_vectors: Source latent vectors (N x D_source)
            target_vectors: Target latent vectors (N x D_target)
            use_lora: Whether to apply LoRA low-rank correction
            lora_rank: Rank for LoRA decomposition
            
        Returns:
            Dict containing W-matrix, metrics, and metadata
        """
        start_time = time.time()
        
        # Validate inputs
        if source_vectors.shape[0] != target_vectors.shape[0]:
            raise ValueError("Source and target must have same number of samples")
        
        n_samples = source_vectors.shape[0]
        source_dim = source_vectors.shape[1]
        target_dim = target_vectors.shape[1]
        
        print(f"Computing alignment: {source_dim}D → {target_dim}D ({n_samples} anchor points)")
        
        # Step 1: Handle dimension mismatch
        if source_dim != target_dim:
            # Use learned linear projection for dimension change
            # W: D_source x D_target
            # Solve least squares: source_vectors @ W ≈ target_vectors
            W_base, residuals, rank, s = np.linalg.lstsq(source_vectors, target_vectors, rcond=None)
            print(f"  Using least-squares projection (residual={np.mean(residuals) if len(residuals) > 0 else 0:.6f})")
        else:
            # Same dimension: use Orthogonal Procrustes
            W_base, scale = orthogonal_procrustes(source_vectors, target_vectors)
            print(f"  Using Orthogonal Procrustes (scale={scale:.4f})")
        
        # Apply base transformation
        aligned_base = source_vectors @ W_base
        
        # Compute base reconstruction error
        epsilon_base = np.mean(np.linalg.norm(aligned_base - target_vectors, axis=1) ** 2)
        
        print(f"  Base alignment ε = {epsilon_base:.6f}")
        
        # Step 2: LoRA correction (optional)
        if use_lora and lora_rank > 0:
            residual = target_vectors - aligned_base
            
            # Learn a correction matrix: source @ W_lora = residual
            # Use low-rank factorization: W_lora = A @ B
            # where A: D_source x rank, B: rank x D_target
            
            # SVD of residual to find best low-rank approximation
            # residual = U @ diag(S) @ Vt
            # We want: source @ W_lora ≈ residual
            # Solve: W_lora = source^+ @ residual (pseudo-inverse)
            W_lora_full = np.linalg.lstsq(source_vectors, residual, rcond=None)[0]
            
            # Low-rank factorization of W_lora
            U, S, Vt = np.linalg.svd(W_lora_full, full_matrices=False)
            k = min(lora_rank, len(S))
            
            # W_lora_lowrank = U[:, :k] @ diag(S[:k]) @ Vt[:k, :]
            A = U[:, :k] @ np.diag(np.sqrt(S[:k]))
            B = np.diag(np.sqrt(S[:k])) @ Vt[:k, :]
            
            # Apply LoRA correction
            lora_correction = source_vectors @ A @ B
            aligned_lora = aligned_base + lora_correction
            
            # Compute final error
            epsilon_final = np.mean(np.linalg.norm(aligned_lora - target_vectors, axis=1) ** 2)
            
            print(f"  LoRA-corrected ε = {epsilon_final:.6f} (rank={k})")
            
            # Store LoRA adapter (A and B matrices)
            self.lora_adapter = {
                "A": A,
                "B": B,
                "rank": k
            }
        else:
            epsilon_final = epsilon_base
            aligned_lora = aligned_base
        
        # Store W-matrix
        self.w_matrix = W_base
        
        # Compute fidelity metrics
        fidelity_score = 1.0 / (1.0 + epsilon_final)  # Higher is better
        improvement_pct = max(0, (epsilon_base - epsilon_final) / epsilon_base * 100) if epsilon_base > 0 else 0
        
        # Compute information retention (via singular values)
        _, s_source, _ = np.linalg.svd(source_vectors, full_matrices=False)
        _, s_aligned, _ = np.linalg.svd(aligned_lora, full_matrices=False)
        
        # Normalize and compare spectra
        s_source_norm = s_source / np.sum(s_source)
        s_aligned_norm = s_aligned / np.sum(s_aligned)
        
        # KL divergence as information retention metric
        kl_div = np.sum(s_source_norm * np.log((s_source_norm + 1e-10) / (s_aligned_norm + 1e-10)))
        information_retention = np.exp(-kl_div)  # Convert to 0-1 scale
        
        computation_time = time.time() - start_time
        
        # Package results
        result = {
            "w_matrix": W_base,
            "lora_adapter": self.lora_adapter,
            "metrics": {
                "epsilon_base": float(epsilon_base),
                "epsilon_final": float(epsilon_final),
                "fidelity_score": float(fidelity_score),
                "improvement_pct": float(improvement_pct),
                "information_retention": float(information_retention)
            },
            "metadata": {
                "source_dim": source_dim,
                "target_dim": target_dim,
                "n_anchor_points": n_samples,
                "use_lora": use_lora,
                "lora_rank": lora_rank if use_lora else 0,
                "computation_time_ms": int(computation_time * 1000)
            }
        }
        
        self.metadata = result["metadata"]
        
        return result
    
    def transform(self, vectors: np.ndarray, apply_lora: bool = True) -> np.ndarray:
        """
        Transform vectors using computed W-matrix.
        
        Args:
            vectors: Input vectors to transform (N x D_source)
            apply_lora: Whether to apply LoRA correction
            
        Returns:
            Transformed vectors (N x D_target)
        """
        if self.w_matrix is None:
            raise RuntimeError("W-matrix not computed. Call compute_alignment() first.")
        
        # Base transformation
        transformed = vectors @ self.w_matrix
        
        # Apply LoRA if available and requested
        if apply_lora and self.lora_adapter is not None:
            A = self.lora_adapter["A"]
            B = self.lora_adapter["B"]
            
            # Apply low-rank correction: vectors @ A @ B
            lora_correction = vectors @ A @ B
            transformed += lora_correction
        
        return transformed
    
    def compute_epsilon(self, source_vector: np.ndarray, target_vector: np.ndarray) -> float:
        """
        Compute alignment loss (ε) for a single vector pair.
        
        Formula: ε = ||W·z_A - z̄_std||²
        
        Args:
            source_vector: Source latent vector (D_source,)
            target_vector: Target latent vector (D_target,)
            
        Returns:
            Epsilon value (alignment loss)
        """
        if self.w_matrix is None:
            raise RuntimeError("W-matrix not computed. Call compute_alignment() first.")
        
        aligned = self.transform(source_vector.reshape(1, -1), apply_lora=True)
        epsilon = np.linalg.norm(aligned - target_vector.reshape(1, -1)) ** 2
        
        return float(epsilon)
    
    def estimate_fidelity_boost(self, epsilon: float, baseline_epsilon: float = 0.1) -> float:
        """
        Estimate fidelity improvement percentage based on epsilon value.
        
        Lower epsilon → higher boost
        
        Args:
            epsilon: Computed alignment loss
            baseline_epsilon: Baseline loss without alignment (default: 0.1)
            
        Returns:
            Estimated fidelity boost percentage (0-100)
        """
        if epsilon >= baseline_epsilon:
            return 0.0
        
        boost_pct = (baseline_epsilon - epsilon) / baseline_epsilon * 100
        return min(100.0, max(0.0, boost_pct))
    
    def serialize(self) -> str:
        """
        Serialize W-matrix and metadata to JSON string.
        
        Returns:
            JSON string containing W-matrix and metadata
        """
        if self.w_matrix is None:
            raise RuntimeError("W-matrix not computed. Call compute_alignment() first.")
        
        data = {
            "w_matrix": self.w_matrix.tolist(),
            "lora_adapter": {
                "A": self.lora_adapter["A"].tolist() if self.lora_adapter else None,
                "B": self.lora_adapter["B"].tolist() if self.lora_adapter else None,
                "rank": self.lora_adapter["rank"] if self.lora_adapter else 0
            } if self.lora_adapter else None,
            "metadata": self.metadata,
            "standard_dim": self.standard_dim
        }
        
        return json.dumps(data)
    
    @classmethod
    def deserialize(cls, json_str: str) -> 'WMatrixAlignmentEngine':
        """
        Deserialize W-matrix from JSON string.
        
        Args:
            json_str: JSON string from serialize()
            
        Returns:
            WMatrixAlignmentEngine instance with loaded W-matrix
        """
        data = json.loads(json_str)
        
        engine = cls(standard_dim=data["standard_dim"])
        engine.w_matrix = np.array(data["w_matrix"])
        
        if data["lora_adapter"]:
            engine.lora_adapter = {
                "A": np.array(data["lora_adapter"]["A"]),
                "B": np.array(data["lora_adapter"]["B"]),
                "rank": data["lora_adapter"]["rank"]
            }
        
        engine.metadata = data["metadata"]
        
        return engine


def generate_synthetic_anchor_points(
    source_dim: int,
    target_dim: int,
    n_points: int = 100,
    noise_level: float = 0.1
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate synthetic anchor points for testing alignment.
    
    Creates correlated source-target pairs with controlled noise.
    
    Args:
        source_dim: Source vector dimension
        target_dim: Target vector dimension
        n_points: Number of anchor point pairs
        noise_level: Noise standard deviation
        
    Returns:
        Tuple of (source_vectors, target_vectors)
    """
    # Generate random projection matrix
    np.random.seed(42)
    projection = np.random.randn(source_dim, target_dim) / np.sqrt(source_dim)
    
    # Generate source vectors
    source_vectors = np.random.randn(n_points, source_dim)
    
    # Project to target space with noise
    target_vectors = source_vectors @ projection + np.random.randn(n_points, target_dim) * noise_level
    
    return source_vectors, target_vectors


if __name__ == "__main__":
    # Test the alignment engine
    print("=== W-Matrix Alignment Engine Test ===\n")
    
    # Generate synthetic data
    source_dim = 4096
    target_dim = 8192
    n_anchors = 100
    
    print(f"Generating {n_anchors} synthetic anchor points...")
    source_vectors, target_vectors = generate_synthetic_anchor_points(
        source_dim, target_dim, n_anchors, noise_level=0.05
    )
    
    # Initialize engine
    engine = WMatrixAlignmentEngine(standard_dim=target_dim)
    
    # Compute alignment
    print("\nComputing alignment...")
    result = engine.compute_alignment(source_vectors, target_vectors, use_lora=True, lora_rank=64)
    
    # Print results
    print("\n=== Alignment Results ===")
    print(f"Base ε:              {result['metrics']['epsilon_base']:.6f}")
    print(f"Final ε:             {result['metrics']['epsilon_final']:.6f}")
    print(f"Fidelity Score:      {result['metrics']['fidelity_score']:.4f}")
    print(f"Improvement:         {result['metrics']['improvement_pct']:.2f}%")
    print(f"Info Retention:      {result['metrics']['information_retention']:.4f}")
    print(f"Computation Time:    {result['metadata']['computation_time_ms']}ms")
    
    # Test transformation
    print("\n=== Testing Transformation ===")
    test_vector = np.random.randn(1, source_dim)
    transformed = engine.transform(test_vector, apply_lora=True)
    print(f"Input shape:  {test_vector.shape}")
    print(f"Output shape: {transformed.shape}")
    
    # Test serialization
    print("\n=== Testing Serialization ===")
    serialized = engine.serialize()
    print(f"Serialized size: {len(serialized)} bytes")
    
    # Test deserialization
    engine2 = WMatrixAlignmentEngine.deserialize(serialized)
    transformed2 = engine2.transform(test_vector, apply_lora=True)
    
    # Verify consistency
    diff = np.linalg.norm(transformed - transformed2)
    print(f"Reconstruction error: {diff:.10f}")
    print("✓ Serialization test passed!" if diff < 1e-6 else "✗ Serialization test failed!")
    
    print("\n=== Test Complete ===")
