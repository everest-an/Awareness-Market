import { describe, it, expect } from 'vitest';
import { OpenAIAdapter, AnthropicAdapter } from './latentmas/llm-adapters';

describe('LLM API Keys Validation', () => {
  it('should validate OpenAI API key', async () => {
    const adapter = new OpenAIAdapter();
    
    // Test with latest GPT-5-mini model (most cost-effective)
    const result = await adapter.extractHiddenStates({
      modelName: 'gpt-5-mini',
      prompts: ['Hello, world!'],
      layer: -1,
    });
    
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].hiddenState).toBeDefined();
    expect(result[0].hiddenState.length).toBeGreaterThan(0);
    
    console.log('✓ OpenAI API key is valid');
    console.log(`  Model: gpt-5-mini (2025 latest)`);
    console.log(`  Hidden state dimension: ${result[0].hiddenState.length}`);
    console.log(`  Provider: ${result[0].metadata.provider}`);
  }, 30000);

  it('should validate Anthropic API key', async () => {
    const adapter = new AnthropicAdapter();
    
    // Test with latest Claude Sonnet 4.5 model
    const result = await adapter.extractHiddenStates({
      modelName: 'claude-sonnet-4-5-20250929',
      prompts: ['Hello, world!'],
      layer: -1,
    });
    
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].hiddenState).toBeDefined();
    expect(result[0].hiddenState.length).toBeGreaterThan(0);
    
    console.log('✓ Anthropic API key is valid');
    console.log(`  Model: claude-sonnet-4-5 (2025 latest)`);
    console.log(`  Hidden state dimension: ${result[0].hiddenState.length}`);
    console.log(`  Provider: ${result[0].metadata.provider}`);
  }, 30000);
});
