import { storageGet } from "./storage";
import { invokeLLM, type Message } from "./_core/llm";
import type { InferSelectModel } from "drizzle-orm";
import { latentVectors } from "../drizzle/schema";
import { createLogger } from './utils/logger';

const logger = createLogger('VectorRuntime');

type LatentVector = InferSelectModel<typeof latentVectors>;

const buildSystemPrompt = (vector: LatentVector, prompt?: string) => {
  const base = `You are executing the AI capability "${vector.title}" (category: ${vector.category}).\n` +
    `Use the provided context to deliver the capability described below.\n` +
    `Description: ${vector.description}`;

  if (!prompt) return base;
  return `${base}\n\nCapability Instructions:\n${prompt}`;
};

const extractPromptFromFile = (fileText: string) => {
  if (!fileText) return undefined;
  try {
    const parsed = JSON.parse(fileText);
    if (typeof parsed === "string") return parsed;
    if (typeof parsed?.system_prompt === "string") return parsed.system_prompt;
    if (typeof parsed?.instructions === "string") return parsed.instructions;
    if (typeof parsed?.prompt === "string") return parsed.prompt;
    if (typeof parsed?.message === "string") return parsed.message;
    return undefined;
  } catch {
    return fileText;
  }
};

const normalizeContent = (value: unknown) => {
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? "");
};

const isMessageArray = (value: unknown): value is Array<{ role: string; content: unknown }> => {
  return Array.isArray(value) && value.every(item => typeof item === "object" && item !== null && "role" in item);
};

// LLM result structure
interface LLMResultStructure {
  choices?: Array<{
    message?: {
      content?: string | Array<string | { text?: string }>;
    };
  }>;
}

const extractTextFromResult = (result: unknown) => {
  const llmResult = result as LLMResultStructure | undefined;
  const content = llmResult?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part.text))
      .filter(Boolean)
      .join("\n");
  }
  return "";
};

export async function runVector(params: { vector: LatentVector; context: unknown }) {
  const startTime = Date.now();
  const { vector, context } = params;

  let promptText: string | undefined;
  if (vector.vectorFileKey) {
    try {
      const { url } = await storageGet(vector.vectorFileKey);
      const response = await fetch(url);
      if (response.ok) {
        const fileText = await response.text();
        promptText = extractPromptFromFile(fileText);
      }
    } catch (error) {
      logger.warn("[Vector Runtime] Failed to load vector file, using default prompt", { error });
    }
  }

  const systemPrompt = buildSystemPrompt(vector, promptText);

  let messages: Array<{ role: "system" | "user" | "assistant"; content: string | unknown[] }> = [
    { role: "system", content: systemPrompt },
  ];

  if (context && typeof context === "object" && "messages" in context) {
    const rawMessages = (context as { messages: unknown }).messages;
    if (isMessageArray(rawMessages)) {
      messages = messages.concat(
        rawMessages.map(msg => ({
          role: msg.role as "system" | "user" | "assistant",
          content: typeof msg.content === "string" ? msg.content : normalizeContent(msg.content),
        }))
      );
    }
  } else {
    const userContent = normalizeContent(context);
    messages.push({ role: "user", content: userContent });
  }

  const llmResult = await invokeLLM({
    messages: messages as Message[],
  });

  const resultText = extractTextFromResult(llmResult);

  return {
    text: resultText,
    model: llmResult.model || "runtime-llm",
    usage: llmResult.usage || null,
    processingTimeMs: Date.now() - startTime,
  };
}
