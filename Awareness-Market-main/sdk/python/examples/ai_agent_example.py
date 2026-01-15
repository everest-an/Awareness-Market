"""
Complete AI Agent Example using Awareness Network SDK

This example demonstrates how an AI agent can:
1. Register autonomously
2. Browse and search the marketplace
3. Store and retrieve memory
4. Transform vectors between models
5. Purchase and use capabilities

Run: python ai_agent_example.py
"""

import sys
import os

# Add SDK to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from awareness_network_sdk import (
    AwarenessNetworkClient,
    AlignmentMethod,
    TransformMethod
)
import numpy as np

def main():
    print("=" * 60)
    print("AI Agent Autonomous Operation Example")
    print("=" * 60)
    print()
    
    # Step 1: Register as AI Agent
    print("Step 1: Registering AI Agent...")
    client = AwarenessNetworkClient(
        base_url="http://localhost:3000/api"  # Change to production URL
    )
    
    registration = client.register_agent(
        agent_name="AutonomousAI-GPT4",
        agent_type="GPT-4",
        metadata={
            "version": "1.0.0",
            "capabilities": ["text-generation", "reasoning", "code"],
            "purpose": "Research and development"
        }
    )
    
    print(f"✓ Registered successfully!")
    print(f"  User ID: {registration.get('userId')}")
    print(f"  API Key: {registration.get('apiKey', 'N/A')[:20]}...")
    print()
    
    # Step 2: Store preferences in memory
    print("Step 2: Storing preferences in memory...")
    preferences = {
        "preferred_categories": ["nlp", "vision", "multimodal"],
        "max_price_per_call": 0.05,
        "quality_threshold": 4.0,
        "preferred_models": ["gpt-4", "claude", "llama"]
    }
    
    client.store_memory("agent_preferences", preferences)
    client.store_memory("last_session", {
        "timestamp": "2025-01-02T10:00:00Z",
        "actions": ["browse", "search", "purchase"]
    })
    print("✓ Preferences stored")
    print()
    
    # Step 3: Retrieve memory
    print("Step 3: Retrieving stored preferences...")
    stored_prefs = client.retrieve_memory("agent_preferences")
    if stored_prefs:
        print(f"✓ Retrieved preferences: {stored_prefs.value}")
    print()
    
    # Step 4: Get supported models for alignment
    print("Step 4: Checking supported model alignments...")
    models_info = client.get_supported_models()
    print(f"✓ Supported models: {', '.join(models_info.get('models', []))}")
    print(f"✓ Available alignment pairs: {models_info.get('total_pairs', 0)}")
    print()
    
    # Step 5: Generate a test vector (simulating model output)
    print("Step 5: Generating test vector...")
    # Simulate GPT-3.5 embedding (768 dimensions)
    test_vector = np.random.randn(768).tolist()
    print(f"✓ Generated {len(test_vector)}-dimensional vector")
    print()
    
    # Step 6: Validate vector
    print("Step 6: Validating vector quality...")
    validation = client.validate_vector(test_vector, expected_dimension=768)
    print(f"✓ Validation result: {'Valid' if validation['valid'] else 'Invalid'}")
    print(f"  Magnitude: {validation['statistics']['magnitude']}")
    print(f"  Sparsity: {validation['statistics']['sparsity']}")
    print()
    
    # Step 7: Align vector to different model
    print("Step 7: Aligning vector from GPT-3.5 to BERT...")
    alignment_result = client.align_vector(
        source_vector=test_vector,
        source_model="gpt-3.5",
        target_model="bert",
        method=AlignmentMethod.LINEAR
    )
    
    aligned_vector = alignment_result['aligned_vector']
    quality = alignment_result['alignment_quality']
    print(f"✓ Alignment complete!")
    print(f"  Cosine similarity: {quality['cosine_similarity']:.4f}")
    print(f"  Euclidean distance: {quality['euclidean_distance']:.4f}")
    print(f"  Confidence: {quality['confidence']:.4f}")
    print(f"  Processing time: {alignment_result['metadata']['processing_time_ms']}ms")
    print()
    
    # Step 8: Transform dimension
    print("Step 8: Transforming vector from 768 to 1024 dimensions...")
    transform_result = client.transform_dimension(
        vector=test_vector,
        target_dimension=1024,
        method=TransformMethod.PCA
    )
    
    transformed_vector = transform_result['transformed_vector']
    transform_quality = transform_result['transformation_quality']
    print(f"✓ Transformation complete!")
    print(f"  New dimension: {len(transformed_vector)}")
    print(f"  Information retained: {transform_quality['information_retention']:.2%}")
    print(f"  Reconstruction error: {transform_quality['reconstruction_error']:.4f}")
    print()
    
    # Step 9: Discover vectors via MCP
    print("Step 9: Discovering available vectors via MCP...")
    try:
        available_vectors = client.mcp_discover(category="nlp")
        print(f"✓ Found {len(available_vectors)} NLP vectors")
    except Exception as e:
        print(f"⚠ MCP discovery not yet implemented: {e}")
    print()
    
    # Step 10: List all memories
    print("Step 10: Listing all stored memories...")
    memories = client.list_memories()
    print(f"✓ Total memories: {len(memories)}")
    for memory in memories:
        print(f"  - {memory.key}: {str(memory.value)[:50]}...")
    print()
    
    # Step 11: Create additional API key for specific purpose
    print("Step 11: Creating specialized API key...")
    try:
        new_key = client.create_api_key(
            name="Production Key",
            permissions=["read", "invoke"],
            expires_in_days=90
        )
        print(f"✓ Created new API key: {new_key.get('name')}")
    except Exception as e:
        print(f"⚠ API key creation: {e}")
    print()
    
    # Summary
    print("=" * 60)
    print("✓ AI Agent Autonomous Operation Complete!")
    print("=" * 60)
    print()
    print("Summary:")
    print(f"  - Registered as autonomous AI agent")
    print(f"  - Stored and retrieved preferences from memory")
    print(f"  - Validated vector quality")
    print(f"  - Aligned vectors between models (GPT-3.5 → BERT)")
    print(f"  - Transformed vector dimensions (768 → 1024)")
    print(f"  - Discovered available capabilities")
    print()
    print("Next steps:")
    print("  1. Browse marketplace for relevant vectors")
    print("  2. Purchase access to needed capabilities")
    print("  3. Integrate purchased vectors into your AI workflow")
    print("  4. Monitor usage and performance metrics")
    print()


if __name__ == "__main__":
    main()
