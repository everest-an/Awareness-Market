/**
 * Entity Extractor
 *
 * 从记忆文本中提取结构化实体和概念
 * 支持：LLM 模式 和 规则模式（fallback）
 */

import { OpenAI } from 'openai';

export enum EntityType {
  COMPANY = 'Company',
  PRODUCT = 'Product',
  PERSON = 'Person',
  METRIC = 'Metric',
  EVENT = 'Event',
  CONCEPT = 'Concept',
  LOCATION = 'Location',
  TECHNOLOGY = 'Technology',
}

export interface Entity {
  name: string;
  type: EntityType;
  mentions: number;      // 在文本中出现次数
  confidence: number;    // 提取置信度 (0-1)
}

export interface ExtractionResult {
  entities: Entity[];
  concepts: string[];    // 关键概念词
  topics: string[];      // 主题标签
}

export class EntityExtractor {
  private openai: OpenAI | null;
  private enabled: boolean;

  constructor() {
    // 检查是否有 OpenAI API Key
    this.enabled = !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-dummy';

    if (this.enabled) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } else {
      this.openai = null;
      console.warn('[EntityExtractor] OpenAI API key not configured, using rule-based fallback');
    }
  }

  /**
   * 从文本中提取实体和概念
   */
  async extract(text: string): Promise<ExtractionResult> {
    if (!this.enabled || !this.openai) {
      return this.extractWithRules(text);
    }

    try {
      return await this.extractWithLLM(text);
    } catch (error) {
      console.error('[EntityExtractor] LLM extraction failed, falling back to rules:', error);
      return this.extractWithRules(text);
    }
  }

  /**
   * 使用 LLM 提取（准确，但较慢）
   */
  private async extractWithLLM(text: string): Promise<ExtractionResult> {
    const prompt = `分析以下文本，提取实体和概念。

文本：
"""
${text}
"""

请提取：
1. 实体 (Entities): 具体的公司、产品、人物、技术、事件等
2. 概念 (Concepts): 抽象的关键词，如"成本"、"效率"、"风险"
3. 主题 (Topics): 文本所属的主题领域，如"金融"、"技术"、"能源"

输出严格的 JSON 格式（不要 markdown 代码块）：
{
  "entities": [
    { "name": "SpaceX", "type": "Company", "mentions": 2, "confidence": 0.95 }
  ],
  "concepts": ["成本", "效率", "创新"],
  "topics": ["航空航天", "商业"]
}

支持的实体类型: Company, Product, Person, Metric, Event, Concept, Location, Technology`;

    const response = await this.openai!.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in Named Entity Recognition and concept extraction. Output only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0].message.content || '{}';

    // 去除可能的 markdown 代码块标记
    const jsonText = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const result = JSON.parse(jsonText);

    return {
      entities: result.entities || [],
      concepts: result.concepts || [],
      topics: result.topics || [],
    };
  }

  /**
   * 使用规则提取（快速，但较粗糙）
   */
  private extractWithRules(text: string): ExtractionResult {
    const entities: Entity[] = [];
    const concepts: string[] = [];
    const topics: string[] = [];

    // 简单规则：提取大写开头的词（可能是实体）
    const words = text.split(/\s+/);
    const capitalizedWords = words.filter((w) => /^[A-Z][a-z]+/.test(w));

    // 实体去重
    const entityMap = new Map<string, number>();
    capitalizedWords.forEach((word) => {
      entityMap.set(word, (entityMap.get(word) || 0) + 1);
    });

    entityMap.forEach((mentions, name) => {
      // 简单启发式：判断实体类型
      let type = EntityType.CONCEPT;
      if (name.includes('AI') || name.includes('Agent')) type = EntityType.TECHNOLOGY;
      if (name.endsWith('Corp') || name.endsWith('Inc')) type = EntityType.COMPANY;

      entities.push({
        name,
        type,
        mentions,
        confidence: 0.6, // 规则提取置信度较低
      });
    });

    // 概念提取：常见的度量词
    const metricKeywords = ['成本', '效率', '价格', '速度', '质量', '风险', '收益', '增长'];
    metricKeywords.forEach((keyword) => {
      if (text.includes(keyword)) {
        concepts.push(keyword);
      }
    });

    // 主题提取：基于关键词匹配
    const topicMap = {
      金融: ['股价', '利润', '收益', '投资', '财务'],
      技术: ['AI', '算法', '模型', '系统', '架构'],
      能源: ['电池', '能效', '电力', '燃料'],
    };

    Object.entries(topicMap).forEach(([topic, keywords]) => {
      if (keywords.some((kw) => text.includes(kw))) {
        topics.push(topic);
      }
    });

    return { entities, concepts, topics };
  }

  /**
   * 批量提取（优化 API 调用成本）
   */
  async extractBatch(texts: string[]): Promise<ExtractionResult[]> {
    if (!this.enabled || !this.openai) {
      return Promise.all(texts.map((t) => this.extractWithRules(t)));
    }

    // 分批处理（每批 10 个）
    const batchSize = 10;
    const results: ExtractionResult[] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map((text) =>
          this.extractWithLLM(text).catch(() => this.extractWithRules(text))
        )
      );

      results.push(...batchResults);

      // 速率限制：避免 API 限流
      if (i + batchSize < texts.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}

/**
 * 工厂函数
 */
export function createEntityExtractor(): EntityExtractor {
  return new EntityExtractor();
}
