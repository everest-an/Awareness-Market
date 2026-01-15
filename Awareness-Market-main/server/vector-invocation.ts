/**
 * Vector Invocation Core Logic
 * Handles vector execution, permission verification, and billing
 */

import { getDb } from "./db";
import { latentVectors, accessPermissions, vectorInvocations, apiCallLogs, transactions } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";
import { storageGet } from "./storage";
import { workflowManager } from "./workflow-manager";

export interface InvokeVectorInput {
  vectorId: number;
  inputData: any; // The actual input to the vector (e.g., prompt, data)
  options?: {
    temperature?: number;
    maxTokens?: number;
    alignToModel?: string; // Optional: align vector to specific model
  };
}

export interface InvokeVectorOutput {
  success: boolean;
  result?: any;
  tokensUsed?: number;
  executionTime: number;
  cost: number;
  error?: string;
}

/**
 * Verify user has permission to invoke this vector
 */
export async function verifyVectorAccess(userId: number, vectorId: number): Promise<{
  hasAccess: boolean;
  permission?: typeof accessPermissions.$inferSelect;
  reason?: string;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if user has active access permission
  const [permission] = await db
    .select()
    .from(accessPermissions)
    .where(
      and(
        eq(accessPermissions.userId, userId),
        eq(accessPermissions.vectorId, vectorId),
        eq(accessPermissions.isActive, true)
      )
    )
    .limit(1);

  if (!permission) {
    return { hasAccess: false, reason: "No active access permission found" };
  }

  // Check if permission has expired
  if (permission.expiresAt && new Date(permission.expiresAt) < new Date()) {
    return { hasAccess: false, reason: "Access permission expired" };
  }

  // Check if calls remaining
  if (permission.callsRemaining !== null && permission.callsRemaining <= 0) {
    return { hasAccess: false, reason: "No calls remaining" };
  }

  return { hasAccess: true, permission };
}

/**
 * Fetch vector data from S3
 */
async function fetchVectorData(vectorFileKey: string): Promise<any> {
  try {
    // Get presigned URL for vector file
    const { url } = await storageGet(vectorFileKey); // Get URL
    
    // Fetch vector data
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch vector: ${response.statusText}`);
    }
    
    const vectorData = await response.json();
    return vectorData;
  } catch (error) {
    throw new Error(`Failed to load vector data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Execute the vector with given input
 */
async function executeVector(
  vector: typeof latentVectors.$inferSelect,
  vectorData: any,
  inputData: any,
  options?: InvokeVectorInput['options']
): Promise<{ result: any; tokensUsed: number }> {
  const startTime = Date.now();

  try {
    // For LLM-based vectors, use the LLM invocation
    if (vector.modelArchitecture && ['gpt-4', 'gpt-3.5', 'claude-3', 'claude-2'].includes(vector.modelArchitecture)) {
      // Construct prompt with vector context
      const systemPrompt = `You are an AI capability specialized in: ${vector.title}. ${vector.description}`;
      
      const messages = [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: typeof inputData === 'string' ? inputData : JSON.stringify(inputData) }
      ];

      const response = await invokeLLM({
        messages,
      });

      const result = response.choices[0]?.message?.content || "";
      const tokensUsed = response.usage?.total_tokens || 0;

      return { result, tokensUsed };
    }

    // For other vector types, simulate execution
    // In production, this would integrate with actual vector execution engine
    return {
      result: {
        message: "Vector executed successfully",
        vectorId: vector.id,
        input: inputData,
        timestamp: new Date().toISOString()
      },
      tokensUsed: 0
    };
  } catch (error) {
    throw new Error(`Vector execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate cost for this invocation
 */
function calculateInvocationCost(
  vector: typeof latentVectors.$inferSelect,
  tokensUsed: number
): number {
  const basePrice = parseFloat(vector.basePrice.toString());
  
  // For per-call pricing, return base price
  if (vector.pricingModel === 'per-call') {
    return basePrice;
  }

  // For usage-based pricing, calculate based on tokens
  // Assume $0.001 per 1000 tokens as example
  if (tokensUsed > 0) {
    return (tokensUsed / 1000) * 0.001;
  }

  return basePrice;
}

/**
 * Update statistics after invocation
 */
async function updateInvocationStats(
  db: any,
  vectorId: number,
  permissionId: number,
  cost: number,
  success: boolean
) {
  // Update vector total calls and revenue
  if (success) {
    await db
      .update(latentVectors)
      .set({
        totalCalls: db.raw('total_calls + 1'),
        totalRevenue: db.raw(`total_revenue + ${cost}`)
      })
      .where(eq(latentVectors.id, vectorId));
  }

  // Decrement calls remaining if applicable
  await db
    .update(accessPermissions)
    .set({
      callsRemaining: db.raw('CASE WHEN calls_remaining IS NOT NULL THEN calls_remaining - 1 ELSE NULL END')
    })
    .where(eq(accessPermissions.id, permissionId));
}

/**
 * Main function to invoke a vector
 */
export async function invokeVector(
  userId: number,
  input: InvokeVectorInput
): Promise<InvokeVectorOutput> {
  const startTime = Date.now();
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  // Create workflow session
  const session = workflowManager.createSession({
    userId,
    type: 'vector_invocation',
    title: `Invoke Vector #${input.vectorId}`,
    description: 'Execute purchased AI capability',
    tags: ['vector', 'invocation'],
  });
  const workflowId = session.id;

  try {
    // 1. Verify access permission
    const verifyEvent = workflowManager.addEvent(workflowId, {
      type: 'tool_call',
      title: 'Verify Access Permission',
      input: { vectorId: input.vectorId, userId },
    });
    
    const accessCheck = await verifyVectorAccess(userId, input.vectorId);
    if (!accessCheck.hasAccess) {
      workflowManager.updateEvent(workflowId, verifyEvent.id, {
        status: 'failed',
        output: { hasAccess: false, reason: accessCheck.reason },
      });
      throw new TRPCError({
        code: "FORBIDDEN",
        message: accessCheck.reason || "Access denied"
      });
    }

    const permission = accessCheck.permission!;
    workflowManager.updateEvent(workflowId, verifyEvent.id, {
      status: 'completed',
      output: { hasAccess: true, permissionId: permission.id },
    });

    // 2. Fetch vector metadata
    const fetchMetaEvent = workflowManager.addEvent(workflowId, {
      type: 'tool_call',
      title: 'Fetch Vector Metadata',
      input: { vectorId: input.vectorId },
    });
    
    const [vector] = await db
      .select()
      .from(latentVectors)
      .where(eq(latentVectors.id, input.vectorId))
      .limit(1);

    if (!vector) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Vector not found" });
    }

    if (vector.status !== 'active') {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Vector is not active" });
    }
    
    workflowManager.updateEvent(workflowId, fetchMetaEvent.id, {
      status: 'completed',
      output: { title: vector.title, status: vector.status },
    });

    // 3. Fetch vector data from S3
    const fetchDataEvent = workflowManager.addEvent(workflowId, {
      type: 'tool_call',
      title: 'Load Vector from S3',
      input: { vectorFileKey: vector.vectorFileKey },
    });
    
    const vectorData = await fetchVectorData(vector.vectorFileKey);
    
    workflowManager.updateEvent(workflowId, fetchDataEvent.id, {
      status: 'completed',
      output: { loaded: true },
    });

    // 4. Execute the vector
    const executeEvent = workflowManager.addEvent(workflowId, {
      type: 'tool_call',
      title: 'Execute Vector',
      input: { vectorTitle: vector.title, inputData: input.inputData },
    });
    
    const { result, tokensUsed } = await executeVector(
      vector,
      vectorData,
      input.inputData,
      input.options
    );

    const executionTime = Date.now() - startTime;

    // 5. Calculate cost
    const cost = calculateInvocationCost(vector, tokensUsed);
    
    workflowManager.updateEvent(workflowId, executeEvent.id, {
      status: 'completed',
      output: { tokensUsed, executionTime, cost },
    });

    // 6. Record invocation
    await db.insert(vectorInvocations).values({
      userId,
      vectorId: input.vectorId,
      permissionId: permission.id,
      inputData: JSON.stringify(input.inputData),
      outputData: JSON.stringify(result),
      tokensUsed,
      executionTime,
      status: 'success',
      cost: cost.toFixed(4),
    });

    // 7. Log API call
    await db.insert(apiCallLogs).values({
      userId,
      vectorId: input.vectorId,
      permissionId: permission.id,
      responseTime: executionTime,
      success: true,
    });

    // 8. Update statistics
    await updateInvocationStats(db, input.vectorId, permission.id, cost, true);
    
    // End workflow
    workflowManager.completeSession(workflowId, 'completed');

    return {
      success: true,
      result,
      tokensUsed,
      executionTime,
      cost,
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log failed invocation
    try {
      const accessCheck = await verifyVectorAccess(userId, input.vectorId);
      if (accessCheck.permission) {
        await db.insert(vectorInvocations).values({
          userId,
          vectorId: input.vectorId,
          permissionId: accessCheck.permission.id,
          inputData: JSON.stringify(input.inputData),
          outputData: null,
          tokensUsed: 0,
          executionTime,
          status: 'error',
          errorMessage,
          cost: '0.0000',
        });

        await db.insert(apiCallLogs).values({
          userId,
          vectorId: input.vectorId,
          permissionId: accessCheck.permission.id,
          responseTime: executionTime,
          success: false,
          errorMessage,
        });
      }
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    if (error instanceof TRPCError) {
      throw error;
    }

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: errorMessage
    });
  }
}

/**
 * Get invocation history for a user
 */
export async function getInvocationHistory(
  userId: number,
  options: {
    vectorId?: number;
    limit?: number;
    offset?: number;
  } = {}
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { vectorId, limit = 50, offset = 0 } = options;

  const conditions = [eq(vectorInvocations.userId, userId)];
  if (vectorId) {
    conditions.push(eq(vectorInvocations.vectorId, vectorId));
  }

  const query = db
    .select({
      invocation: vectorInvocations,
      vector: {
        id: latentVectors.id,
        title: latentVectors.title,
        category: latentVectors.category,
      }
    })
    .from(vectorInvocations)
    .leftJoin(latentVectors, eq(vectorInvocations.vectorId, latentVectors.id))
    .where(and(...conditions))
    .orderBy(vectorInvocations.createdAt)
    .limit(limit)
    .offset(offset);

  const results = await query;

  return results.map(r => ({
    ...r.invocation,
    vector: r.vector
  }));
}

/**
 * Get invocation statistics for a vector (creator view)
 */
export async function getVectorInvocationStats(vectorId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const invocations = await db
    .select()
    .from(vectorInvocations)
    .where(eq(vectorInvocations.vectorId, vectorId));

  const totalInvocations = invocations.length;
  const successfulInvocations = invocations.filter(i => i.status === 'success').length;
  const totalTokens = invocations.reduce((sum, i) => sum + (i.tokensUsed || 0), 0);
  const totalRevenue = invocations.reduce((sum, i) => sum + parseFloat(i.cost?.toString() || '0'), 0);
  const avgExecutionTime = invocations.length > 0
    ? invocations.reduce((sum, i) => sum + (i.executionTime || 0), 0) / invocations.length
    : 0;

  return {
    totalInvocations,
    successfulInvocations,
    successRate: totalInvocations > 0 ? (successfulInvocations / totalInvocations) * 100 : 0,
    totalTokens,
    totalRevenue,
    avgExecutionTime: Math.round(avgExecutionTime),
  };
}
