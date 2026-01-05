"""
KV-Cache Compression Example

Demonstrates how to use the KV-Cache compression API with the Awareness SDK.
"""

from awareness_sdk import AwarenessClient
import numpy as np


def main():
    # Initialize client
    client = AwarenessClient(
        api_key="your_api_key_here",
        base_url="http://localhost:3000"
    )
    
    print("=" * 60)
    print("KV-Cache Compression Example")
    print("=" * 60)
    
    # Example 1: Get supported models
    print("\n1. Getting supported models...")
    models = client.kv_cache.get_supported_models()
    print(f"Found {len(models)} supported models:")
    for model in models[:5]:  # Show first 5
        print(f"  - {model['name']}: {model['attentionType']} attention")
    
    # Example 2: Get model adapter details
    print("\n2. Getting adapter details for GPT-4...")
    adapter = client.kv_cache.get_model_adapter("gpt-4")
    print(f"  Model family: {adapter['modelFamily']}")
    print(f"  Attention type: {adapter['attentionType']}")
    print(f"  Recommended threshold: {adapter['recommendedThreshold']}")
    
    # Example 3: Estimate bandwidth savings
    print("\n3. Estimating bandwidth savings...")
    estimate = client.kv_cache.estimate_savings(
        model_name="gpt-4",
        num_tokens=1000,
        dimension=512
    )
    print(f"  Estimated compression ratio: {estimate['compressionRatio']:.2%}")
    print(f"  Estimated bandwidth savings: {estimate['bandwidthSavingsPercent']:.2f}%")
    print(f"  Tokens saved: {estimate['tokenSavings']}")
    
    # Example 4: Compress KV-Cache
    print("\n4. Compressing KV-Cache...")
    
    # Generate sample KV-Cache data
    num_tokens = 100
    dim = 128
    
    keys = np.random.randn(num_tokens, dim).tolist()
    values = np.random.randn(num_tokens, dim).tolist()
    queries = np.random.randn(5, dim).tolist()
    
    result = client.kv_cache.compress(
        model_name="gpt-4",
        keys=keys,
        values=values,
        queries=queries
    )
    
    print(f"  Original tokens: {result['metrics']['totalTokens']}")
    print(f"  Selected tokens: {result['metrics']['selectedTokens']}")
    print(f"  Compression ratio: {result['metrics']['compressionRatio']:.2%}")
    print(f"  Bandwidth savings: {result['metrics']['bandwidthSavingsPercent']:.2f}%")
    print(f"  Compression time: {result['metrics']['compressionTimeMs']:.2f}ms")
    print(f"  Attention coverage: {result['metrics']['cumulativeAttention']:.2%}")
    
    # Example 5: Validate compression quality
    print("\n5. Validating compression quality...")
    quality = client.kv_cache.validate_quality(
        model_name="gpt-4",
        compressed=result['compressed']
    )
    
    if quality['passed']:
        print("  ✓ Quality check PASSED")
    else:
        print("  ✗ Quality check FAILED")
    
    print(f"  Attention coverage: {quality['attentionCoverage']:.2%}")
    print(f"  Information loss: {quality['informationLoss']:.2%}")
    
    if quality['warnings']:
        print("  Warnings:")
        for warning in quality['warnings']:
            print(f"    - {warning}")
    
    if quality['recommendations']:
        print("  Recommendations:")
        for rec in quality['recommendations']:
            print(f"    - {rec}")
    
    # Example 6: Decompress KV-Cache
    print("\n6. Decompressing KV-Cache...")
    decompressed = client.kv_cache.decompress(
        compressed=result['compressed'],
        original_length=num_tokens
    )
    
    print(f"  Decompressed keys shape: {len(decompressed['keys'])} x {len(decompressed['keys'][0])}")
    print(f"  Decompressed values shape: {len(decompressed['values'])} x {len(decompressed['values'][0])}")
    
    # Example 7: Run benchmark
    print("\n7. Running compression benchmark...")
    benchmark = client.kv_cache.benchmark(
        model_name="gpt-4",
        num_tokens=200,
        dimension=256,
        iterations=5
    )
    
    print(f"  Model: {benchmark['modelName']}")
    print(f"  Avg compression time: {benchmark['compressionTimeMs']:.2f}ms")
    print(f"  Avg decompression time: {benchmark['decompressionTimeMs']:.2f}ms")
    print(f"  Compression ratio: {benchmark['compressionRatio']:.2%}")
    print(f"  Bandwidth savings: {benchmark['bandwidthSavingsPercent']:.2f}%")
    print(f"  Quality passed: {benchmark['qualityPassed']}")
    
    # Example 8: Get compression statistics
    print("\n8. Getting compression statistics...")
    stats = client.kv_cache.get_compression_stats("gpt-4")
    
    print(f"  Model: {stats['modelName']}")
    print(f"  Avg compression time: {stats['avgCompressionTimeMs']:.2f}ms")
    print(f"  Avg bandwidth savings: {stats['avgBandwidthSavings']:.2f}%")
    print(f"  Avg attention coverage: {stats['avgAttentionCoverage']:.2%}")
    
    print("\n" + "=" * 60)
    print("All examples completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    main()
