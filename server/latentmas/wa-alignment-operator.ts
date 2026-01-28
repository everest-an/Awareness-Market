/**
 * Wa Alignment Operator - 真正的 LatentMAS 对齐算子实现
 * 
 * 基于论文规范实现：
 * - 岭回归计算 Wa ≈ (W_out^T × W_out + λI)^(-1) × W_out^T × W_in
 * - 防止激活漂移（Activation Drift）
 * - 支持长程潜空间推理（最高 80 步）
 * 
 * Reference: LatentMAS Paper Section 3.2 - Latent Space Alignment
 */

import { create, all, Matrix, MathJsInstance } from 'mathjs';

const math: MathJsInstance = create(all);

// ============================================================================
// Types
// ============================================================================

export interface WaOperatorConfig {
  /** 岭回归正则化参数 λ，防止矩阵奇异 */
  ridgeLambda: number;
  /** 输入嵌入维度 */
  inputDim: number;
  /** 输出/隐藏状态维度 */
  outputDim: number;
  /** 是否启用激活漂移防护 */
  enableDriftProtection: boolean;
  /** 漂移检测阈值 */
  driftThreshold: number;
}

export interface WaOperator {
  /** Wa 矩阵 */
  matrix: number[][];
  /** 配置 */
  config: WaOperatorConfig;
  /** 元数据 */
  metadata: {
    sourceModel: string;
    computedAt: string;
    conditionNumber: number;
    rank: number;
  };
}

export interface LatentRolloutResult {
  /** 最终的潜思维向量 */
  latentThought: number[];
  /** 所有中间步骤的潜思维 */
  intermediateThoughts: number[][];
  /** 滚动步数 */
  steps: number;
  /** 漂移检测结果 */
  driftMetrics: {
    maxDrift: number;
    avgDrift: number;
    driftDetected: boolean;
  };
  /** 处理时间 */
  processingTimeMs: number;
}

export interface KVCacheState {
  /** 各层的 Key 缓存 */
  keys: number[][][];
  /** 各层的 Value 缓存 */
  values: number[][][];
  /** 序列长度 */
  sequenceLength: number;
  /** 层数 */
  numLayers: number;
  /** 注意力头数 */
  numHeads: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: WaOperatorConfig = {
  ridgeLambda: 0.01,
  inputDim: 4096,
  outputDim: 4096,
  enableDriftProtection: true,
  driftThreshold: 0.5,
};

// ============================================================================
// Wa Operator Implementation
// ============================================================================

/**
 * 计算 Wa 对齐算子
 * 
 * 数学公式：Wa ≈ (W_out^T × W_out + λI)^(-1) × W_out^T × W_in
 * 
 * 这是 LatentMAS 的核心创新：通过岭回归从模型权重计算对齐矩阵，
 * 将输出空间的隐藏状态映射回输入嵌入空间的有效区域。
 * 
 * @param wIn 输入嵌入矩阵 W_in [vocab_size × hidden_dim]
 * @param wOut 输出头矩阵 W_out [hidden_dim × vocab_size]
 * @param config 配置参数
 * @param sourceModel 源模型名称
 */
export function computeWaOperator(
  wIn: number[][],
  wOut: number[][],
  config: Partial<WaOperatorConfig> = {},
  sourceModel: string = 'unknown'
): WaOperator {
  const cfg: WaOperatorConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  // 转换为 mathjs 矩阵
  const W_in = math.matrix(wIn);
  const W_out = math.matrix(wOut);

  // Step 1: 计算 W_out^T
  const W_out_T = math.transpose(W_out) as Matrix;

  // Step 2: 计算 W_out^T × W_out
  const W_out_T_W_out = math.multiply(W_out_T, W_out) as Matrix;

  // Step 3: 添加正则化项 λI
  const size = (W_out_T_W_out.toArray() as number[][]).length;
  const lambdaI = math.multiply(cfg.ridgeLambda, math.identity(size)) as Matrix;
  const regularized = math.add(W_out_T_W_out, lambdaI) as Matrix;

  // Step 4: 计算逆矩阵 (W_out^T × W_out + λI)^(-1)
  let inverse: Matrix;
  try {
    inverse = math.inv(regularized) as Matrix;
  } catch (e) {
    // 如果矩阵奇异，增加正则化强度
    console.warn('[WaOperator] Matrix singular, increasing regularization');
    const strongerLambdaI = math.multiply(cfg.ridgeLambda * 10, math.identity(size)) as Matrix;
    const strongerRegularized = math.add(W_out_T_W_out, strongerLambdaI) as Matrix;
    inverse = math.inv(strongerRegularized) as Matrix;
  }

  // Step 5: 计算 (W_out^T × W_out + λI)^(-1) × W_out^T
  const inverseTimesWoutT = math.multiply(inverse, W_out_T) as Matrix;

  // Step 6: 最终计算 Wa = ... × W_in
  const Wa = math.multiply(inverseTimesWoutT, W_in) as Matrix;

  // 计算条件数（用于评估数值稳定性）
  const waArray = Wa.toArray() as number[][];
  const conditionNumber = estimateConditionNumber(waArray);
  const rank = estimateRank(waArray);

  return {
    matrix: waArray,
    config: cfg,
    metadata: {
      sourceModel,
      computedAt: new Date().toISOString(),
      conditionNumber,
      rank,
    },
  };
}

/**
 * 从预训练模型权重生成模拟的 W_in 和 W_out
 * 
 * 在实际部署中，这些权重应该从 HuggingFace 模型加载：
 * - W_in = model.embed_tokens.weight
 * - W_out = model.lm_head.weight
 * 
 * 这里提供一个模拟实现，用于测试和演示
 */
export function generateSimulatedModelWeights(
  vocabSize: number = 32000,
  hiddenDim: number = 4096
): { wIn: number[][]; wOut: number[][] } {
  // 生成模拟的输入嵌入矩阵 [vocab_size × hidden_dim]
  const wIn: number[][] = [];
  for (let i = 0; i < vocabSize; i++) {
    const row: number[] = [];
    for (let j = 0; j < hiddenDim; j++) {
      // 使用 Xavier 初始化
      const scale = Math.sqrt(2.0 / (vocabSize + hiddenDim));
      row.push((Math.random() * 2 - 1) * scale);
    }
    wIn.push(row);
  }

  // 生成模拟的输出头矩阵 [hidden_dim × vocab_size]
  const wOut: number[][] = [];
  for (let i = 0; i < hiddenDim; i++) {
    const row: number[] = [];
    for (let j = 0; j < vocabSize; j++) {
      const scale = Math.sqrt(2.0 / (vocabSize + hiddenDim));
      row.push((Math.random() * 2 - 1) * scale);
    }
    wOut.push(row);
  }

  return { wIn, wOut };
}

// ============================================================================
// Latent Rollout Implementation
// ============================================================================

/**
 * 执行潜空间滚动（Latent Rollout）
 * 
 * 这是 LatentMAS 的核心推理过程：
 * 1. 从初始隐藏状态 h_0 开始
 * 2. 应用 Wa 对齐：e_{t+1} = h_t × Wa
 * 3. 模拟 forward pass 获取新的 h_{t+1}
 * 4. 重复直到达到指定步数
 * 
 * @param initialHiddenState 初始隐藏状态 h_0
 * @param waOperator Wa 对齐算子
 * @param steps 滚动步数（论文建议 0-80）
 * @param forwardFn 模拟的 forward 函数
 */
export function executeLatentRollout(
  initialHiddenState: number[],
  waOperator: WaOperator,
  steps: number = 20,
  forwardFn?: (embedding: number[]) => number[]
): LatentRolloutResult {
  const startTime = Date.now();
  const intermediateThoughts: number[][] = [];
  const driftValues: number[] = [];

  let h_t = [...initialHiddenState];
  const h_0_magnitude = vectorMagnitude(h_t);

  for (let step = 0; step < steps; step++) {
    // Step 1: 应用 Wa 对齐 e_{t+1} = h_t × Wa
    const e_next = applyWaAlignment(h_t, waOperator.matrix);

    // Step 2: 归一化（防止数值爆炸）
    const normalizedEmbedding = normalizeVector(e_next);

    // Step 3: 模拟 forward pass
    // 在真实实现中，这里会调用模型的 forward 函数
    // outputs = model(inputs_embeds=e_next, past_key_values=kv_cache)
    // h_{t+1} = outputs.hidden_states[-1][:, -1, :]
    const h_next = forwardFn 
      ? forwardFn(normalizedEmbedding)
      : simulateForwardPass(normalizedEmbedding);

    // Step 4: 检测激活漂移
    const drift = vectorMagnitude(h_next) / h_0_magnitude;
    driftValues.push(Math.abs(drift - 1.0));

    // Step 5: 如果启用漂移防护且检测到漂移，应用修正
    if (waOperator.config.enableDriftProtection && 
        Math.abs(drift - 1.0) > waOperator.config.driftThreshold) {
      // 重新归一化到原始幅度
      const correctedH = normalizeVector(h_next).map(v => v * h_0_magnitude);
      h_t = correctedH;
    } else {
      h_t = h_next;
    }

    intermediateThoughts.push([...h_t]);
  }

  const maxDrift = Math.max(...driftValues);
  const avgDrift = driftValues.reduce((a, b) => a + b, 0) / driftValues.length;

  return {
    latentThought: h_t,
    intermediateThoughts,
    steps,
    driftMetrics: {
      maxDrift,
      avgDrift,
      driftDetected: maxDrift > waOperator.config.driftThreshold,
    },
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * 应用 Wa 对齐：e_{t+1} = h_t × Wa
 */
function applyWaAlignment(hiddenState: number[], waMatrix: number[][]): number[] {
  const h = math.matrix([hiddenState]);
  const Wa = math.matrix(waMatrix);
  const result = math.multiply(h, Wa) as Matrix;
  return (result.toArray() as number[][])[0];
}

/**
 * 模拟 forward pass
 * 
 * 在真实实现中，这应该调用实际的 Transformer 模型
 * 这里使用简化的非线性变换来模拟
 */
function simulateForwardPass(embedding: number[]): number[] {
  // 模拟多层 Transformer 的效果
  // 实际上应该是: outputs = model(inputs_embeds=embedding)
  return embedding.map((v, i) => {
    // 模拟残差连接 + 非线性
    const residual = v;
    const transformed = Math.tanh(v * 1.1 + Math.sin(i * 0.01));
    return residual * 0.9 + transformed * 0.1;
  });
}

// ============================================================================
// KV-Cache Management
// ============================================================================

/**
 * 创建空的 KV-Cache 状态
 */
export function createEmptyKVCache(
  numLayers: number = 32,
  numHeads: number = 32,
  headDim: number = 128
): KVCacheState {
  const keys: number[][][] = [];
  const values: number[][][] = [];

  for (let layer = 0; layer < numLayers; layer++) {
    keys.push([]);
    values.push([]);
    for (let head = 0; head < numHeads; head++) {
      keys[layer].push([]);
      values[layer][head] = [];
    }
  }

  return {
    keys,
    values,
    sequenceLength: 0,
    numLayers,
    numHeads,
  };
}

/**
 * 更新 KV-Cache（模拟 use_cache=True 的效果）
 */
export function updateKVCache(
  kvCache: KVCacheState,
  newKeys: number[][][],
  newValues: number[][][]
): KVCacheState {
  const updatedKeys = kvCache.keys.map((layerKeys, layerIdx) =>
    layerKeys.map((headKeys, headIdx) => [
      ...headKeys,
      ...(newKeys[layerIdx]?.[headIdx] || []),
    ])
  );

  const updatedValues = kvCache.values.map((layerValues, layerIdx) =>
    layerValues.map((headValues, headIdx) => [
      ...headValues,
      ...(newValues[layerIdx]?.[headIdx] || []),
    ])
  );

  return {
    keys: updatedKeys,
    values: updatedValues,
    sequenceLength: kvCache.sequenceLength + 1,
    numLayers: kvCache.numLayers,
    numHeads: kvCache.numHeads,
  };
}

/**
 * 合并两个智能体的 KV-Cache
 * 
 * 这是实现"数字感应"的关键：
 * 智能体 B 直接注入智能体 A 的 KV-Cache
 */
export function mergeKVCaches(
  cacheA: KVCacheState,
  cacheB: KVCacheState,
  waOperator?: WaOperator
): KVCacheState {
  // 如果提供了 Wa 算子，先对 cacheA 进行对齐
  let alignedCacheA = cacheA;
  
  if (waOperator) {
    // 对每一层的 KV 进行对齐
    alignedCacheA = {
      ...cacheA,
      keys: cacheA.keys.map(layerKeys =>
        layerKeys.map(headKeys =>
          headKeys.map(k => {
            const aligned = applyWaAlignment([k], waOperator.matrix);
            return aligned[0];
          })
        )
      ),
      values: cacheA.values.map(layerValues =>
        layerValues.map(headValues =>
          headValues.map(v => {
            const aligned = applyWaAlignment([v], waOperator.matrix);
            return aligned[0];
          })
        )
      ),
    };
  }

  // 合并：A 的缓存在前，B 的在后
  return {
    keys: alignedCacheA.keys.map((layerKeys, layerIdx) =>
      layerKeys.map((headKeys, headIdx) => [
        ...headKeys,
        ...(cacheB.keys[layerIdx]?.[headIdx] || []),
      ])
    ),
    values: alignedCacheA.values.map((layerValues, layerIdx) =>
      layerValues.map((headValues, headIdx) => [
        ...headValues,
        ...(cacheB.values[layerIdx]?.[headIdx] || []),
      ])
    ),
    sequenceLength: alignedCacheA.sequenceLength + cacheB.sequenceLength,
    numLayers: Math.max(alignedCacheA.numLayers, cacheB.numLayers),
    numHeads: Math.max(alignedCacheA.numHeads, cacheB.numHeads),
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function vectorMagnitude(vec: number[]): number {
  return Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
}

function normalizeVector(vec: number[]): number[] {
  const mag = vectorMagnitude(vec);
  if (mag === 0) return vec;
  return vec.map(v => v / mag);
}

function estimateConditionNumber(matrix: number[][]): number {
  // 简化的条件数估计（实际应使用 SVD）
  const rows = matrix.length;
  const cols = matrix[0]?.length || 0;
  
  let maxRowSum = 0;
  let minRowSum = Infinity;
  
  for (let i = 0; i < rows; i++) {
    const rowSum = matrix[i].reduce((sum, v) => sum + Math.abs(v), 0);
    maxRowSum = Math.max(maxRowSum, rowSum);
    minRowSum = Math.min(minRowSum, rowSum);
  }
  
  return minRowSum > 0 ? maxRowSum / minRowSum : Infinity;
}

function estimateRank(matrix: number[][]): number {
  // 简化的秩估计
  const rows = matrix.length;
  const cols = matrix[0]?.length || 0;
  
  // 计算非零行数
  let nonZeroRows = 0;
  for (let i = 0; i < rows; i++) {
    const rowMag = matrix[i].reduce((sum, v) => sum + Math.abs(v), 0);
    if (rowMag > 1e-10) nonZeroRows++;
  }
  
  return Math.min(nonZeroRows, cols);
}

// ============================================================================
// Exports
// ============================================================================

export {
  DEFAULT_CONFIG as WA_DEFAULT_CONFIG,
  applyWaAlignment,
  simulateForwardPass,
  vectorMagnitude,
  normalizeVector,
};
