/**
 * F-064 · External-chat UI-noise filtering (source-aware).
 *
 * The browser bridge captures button labels / AI disclaimers from
 * 豆包 / Gemini / ChatGPT. These must be dropped ONLY when
 * source === 'external_chat', leaving IDE/MCP writes untouched.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyNoiseEvent } from '../src/core/noise-filter.mjs';

describe('F-064 external_chat noise filter', () => {
  it('drops pure UI-chrome capture (FM-2)', () => {
    const reason = classifyNoiseEvent({
      source: 'external_chat',
      content: '重新生成 复制 分享 内容由 AI 生成，请仔细甄别',
    });
    assert.ok(reason, 'expected a filter reason');
    assert.match(reason, /external_chat_ui_noise/);
  });

  it('drops English UI-chrome capture', () => {
    const reason = classifyNoiseEvent({
      source: 'external_chat',
      content: 'Regenerate  Copy  Share  Good response  Bad response',
    });
    assert.match(String(reason), /external_chat_ui_noise/);
  });

  it('keeps real content even with trailing UI chrome', () => {
    const reason = classifyNoiseEvent({
      source: 'external_chat',
      content:
        '我们决定用 Qdrant 做 ANN 召回、pgvector 做精确重排，因为混合检索召回率更高。复制 分享',
    });
    assert.equal(reason, null);
  });

  it('does NOT apply external-chat stripping to MCP source', () => {
    // Same short string, but from MCP — must fall through to generic rules,
    // NOT the external_chat_ui_noise branch.
    const reason = classifyNoiseEvent({
      source: 'mcp',
      content: '重新生成 复制 分享 内容由 AI 生成，请仔细甄别',
    });
    // It may still be filtered by generic rules, but never as external chat noise.
    if (reason) assert.doesNotMatch(reason, /external_chat_ui_noise/);
  });

  it('keeps external-chat content when structured insights are present', () => {
    const reason = classifyNoiseEvent({
      source: 'external_chat',
      content: '复制 分享',
      insights: { knowledge_cards: [{ title: 't', summary: 's'.repeat(220) }] },
    });
    assert.equal(reason, null);
  });
});
