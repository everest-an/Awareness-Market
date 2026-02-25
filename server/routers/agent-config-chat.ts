/**
 * Agent Configuration Chat Router
 *
 * LLM-powered chat endpoint for the session creation flow.
 * User describes their project in natural language → AI suggests
 * agent types, orchestration, weights, and tags.
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { invokeLLM } from '../_core/llm';
import { AgentType, AGENT_PROFILES } from '../collaboration/agent-type-system';
import { createLogger } from '../utils/logger';

const logger = createLogger('AgentConfigChat');

const SYSTEM_PROMPT = `You are an AI collaboration configuration assistant for the Awareness Market platform.

The platform supports these agent types:
${Object.values(AGENT_PROFILES)
  .map(
    (p) =>
      `- ${p.type} (${p.name}): Specialties: ${p.specialties.join(', ')}. Authority: ${p.authority}/10`,
  )
  .join('\n')}

Typical agent IDs used in the platform:
- "manus-frontend" — Router/Frontend agent (Manus)
- "claude-backend" — Architect/Backend agent (Claude)
- "v0-visualizer" — Visualizer/UI agent (v0)
- "manus-frontend-1", "manus-frontend-2" — for dual-frontend setups
- "claude-backend-1", "claude-backend-2" — for dual-backend setups

When a user describes their project, you should:
1. Suggest which agents to use (as agentIds)
2. Recommend orchestration: "sequential" (one after another) or "parallel" (all at once)
3. Suggest authority weights (0.1 to 1.0) for each agent
4. Suggest a session name
5. Generate relevant tags/labels for the session

Always respond in JSON format:
{
  "message": "Your natural language explanation to the user (in the SAME language as the user's input)",
  "suggestion": {
    "sessionName": "...",
    "description": "...",
    "type": "frontend-backend" | "dual-frontend" | "dual-backend" | "custom",
    "agents": [{ "id": "...", "label": "...", "weight": 0.0-1.0 }],
    "orchestration": "sequential" | "parallel",
    "tags": ["tag1", "tag2", "tag3"]
  }
}

If the user is still describing and you need more info, set "suggestion" to null and ask a clarifying question.
Always match the user's language (Chinese, English, etc.).`;

export const agentConfigChatRouter = router({
  /**
   * Chat with AI to configure agents for a collaboration session.
   * Returns suggested agent tags, weights, and orchestration type.
   */
  suggestConfig: protectedProcedure
    .input(
      z.object({
        messages: z.array(
          z.object({
            role: z.enum(['user', 'assistant', 'system']),
            content: z.string(),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const result = await invokeLLM({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...input.messages,
          ],
          responseFormat: { type: 'json_object' },
          maxTokens: 1024,
        });

        const responseText = result.choices?.[0]?.message?.content;
        const text = typeof responseText === 'string' ? responseText : '';

        try {
          const parsed = JSON.parse(text);
          return {
            assistantMessage: parsed.message || text,
            suggestion: parsed.suggestion || null,
          };
        } catch {
          // LLM didn't return valid JSON — return raw text
          return {
            assistantMessage: text,
            suggestion: null,
          };
        }
      } catch (error: any) {
        logger.error('Agent config chat failed:', { error: error.message });
        return {
          assistantMessage: 'Sorry, I encountered an error generating suggestions. Please try again.',
          suggestion: null,
        };
      }
    }),
});
